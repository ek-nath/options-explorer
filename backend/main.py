import os
import sqlite3
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from alpaca.trading.client import TradingClient
from alpaca.trading.requests import GetOptionContractsRequest
from alpaca.data.historical import StockHistoricalDataClient, OptionHistoricalDataClient
from alpaca.data.requests import OptionChainRequest, StockLatestQuoteRequest, StockBarsRequest
from alpaca.data.timeframe import TimeFrame
from dotenv import load_dotenv
from datetime import datetime, timedelta
from google import genai
from google.genai import types
from utils import black_scholes, calculate_gex, calculate_dex, identify_walls, calculate_gamma_flip, get_gex_profile, calculate_max_pain, calculate_expected_move, calculate_vanna_exposure, calculate_charm_exposure, ttl_cache

load_dotenv()

app = FastAPI(title="Options Explorer API")

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Alpaca Clients
API_KEY = os.getenv("ALPACA_API_KEY")
SECRET_KEY = os.getenv("ALPACA_SECRET_KEY")
BASE_URL = os.getenv("ALPACA_BASE_URL", "https://paper-api.alpaca.markets")

if not API_KEY or not SECRET_KEY:
    raise ValueError("Alpaca API credentials not found in environment variables.")

trading_client = TradingClient(API_KEY, SECRET_KEY, paper=True if "paper" in BASE_URL else False)
data_client = OptionHistoricalDataClient(API_KEY, SECRET_KEY)
stock_data_client = StockHistoricalDataClient(API_KEY, SECRET_KEY)

# Gemini Setup using the new google-genai SDK
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
client = None
if GEMINI_API_KEY:
    client = genai.Client(api_key=GEMINI_API_KEY)
else:
    print("Warning: GEMINI_API_KEY not found.")

# DB Setup for Historical Tracking
DB_PATH = "options_explorer.db"

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS gex_history
                 (timestamp TEXT, symbol TEXT, total_gex REAL, total_dex REAL, call_wall REAL, put_wall REAL, gamma_flip REAL, max_pain REAL)''')
    conn.commit()
    conn.close()

init_db()

def save_snapshot(symbol, total_gex, total_dex, call_wall, put_wall, gamma_flip, max_pain):
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        now = datetime.now()
        hour_str = now.strftime("%Y-%m-%d %H:00:00")
        c.execute("SELECT 1 FROM gex_history WHERE symbol=? AND timestamp=?", (symbol, hour_str))
        if not c.fetchone():
            c.execute("INSERT INTO gex_history VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                      (hour_str, symbol, total_gex, total_dex, float(call_wall or 0), float(put_wall or 0), float(gamma_flip or 0), float(max_pain or 0)))
            conn.commit()
        conn.close()
    except Exception as e:
        print(f"DB Error: {e}")

# Tool functions for Gemini
def get_market_quote(symbol: str):
    """Retrieves the latest stock quote for a symbol."""
    quote = get_cached_stock_quote(symbol)
    return {"symbol": symbol, "price": quote[symbol].ask_price, "timestamp": str(quote[symbol].timestamp)}

# Data Fetching Helpers with Caching
@ttl_cache(seconds=300)
def get_cached_option_chain(symbol: str):
    req = OptionChainRequest(underlying_symbol=symbol)
    return data_client.get_option_chain(req)

@ttl_cache(seconds=60)
def get_cached_stock_quote(symbol: str):
    req = StockLatestQuoteRequest(symbol_or_symbols=symbol)
    return stock_data_client.get_stock_latest_quote(req)

def get_option_chain_summary(symbol: str):
    """Retrieves a summary of the option chain for a symbol, including spot price and processed contracts."""
    quote = get_cached_stock_quote(symbol)
    spot_price = quote[symbol].ask_price

    # Get OI lookup for better walls calculation
    oi_lookup = {}
    try:
        req = GetOptionContractsRequest(underlying_symbols=[symbol], status="active")
        contracts_resp = trading_client.get_option_contracts(req)
        for c in contracts_resp.option_contracts:
            if c.open_interest:
                oi_lookup[c.symbol] = int(c.open_interest)
    except:
        pass

    chain = get_cached_option_chain(symbol)
    
    all_contracts = []
    for contract_symbol, snapshot in chain.items():
        try:
            strike = float(contract_symbol[-8:]) / 1000
        except:
            continue
            
        oi = get_oi_fallback(contract_symbol, snapshot, oi_lookup)
        metrics = get_contract_metrics(contract_symbol, snapshot, spot_price, oi)
        
        all_contracts.append({
            "contract": contract_symbol,
            "strike": strike,
            "ask": snapshot.latest_quote.ask_price if snapshot.latest_quote else None,
            "bid": snapshot.latest_quote.bid_price if snapshot.latest_quote else None,
            "last": snapshot.latest_trade.price if snapshot.latest_trade else None,
            "implied_vol": snapshot.implied_volatility,
            "gex": metrics["gex"],
            "delta": metrics["delta"]
        })

    # Identify walls using the full chain
    call_wall, put_wall = identify_walls(all_contracts, spot_price)

    # Sort by proximity to spot price and take top 20
    sorted_chain = sorted(all_contracts, key=lambda x: abs(x["strike"] - spot_price))
    relevant_chain = sorted_chain[:20]
    
    # Sort relevant chain by strike for readability
    relevant_chain = sorted(relevant_chain, key=lambda x: x["strike"])

    return {
        "symbol": symbol,
        "spot_price": spot_price,
        "call_wall": call_wall,
        "put_wall": put_wall,
        "chain_summary": relevant_chain
    }

def get_historical_stock_data(symbol: str, days: int = 30):
    """Retrieves historical daily bars for a stock symbol."""
    start_date = datetime.now() - timedelta(days=days)
    request_params = StockBarsRequest(
        symbol_or_symbols=symbol,
        timeframe=TimeFrame.Day,
        start=start_date
    )
    bars = stock_data_client.get_stock_bars(request_params)
    return {"symbol": symbol, "bars": [
        {"time": b.timestamp.strftime("%Y-%m-%d"), "close": b.close}
        for b in bars[symbol]
    ]}

@app.get("/")
async def root():
    return {"message": "Options Explorer API is running"}

@app.get("/api/health")
async def health():
    try:
        account = trading_client.get_account()
        return {"status": "ok", "alpaca_connected": True, "account_status": account.status}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/stock/bars/{symbol}")
async def get_stock_bars(symbol: str, timeframe: str = "1Day", days: int = 30):
    try:
        tf = TimeFrame.Day if timeframe == "1Day" else TimeFrame.Hour
        start_date = datetime.now() - timedelta(days=days)
        request_params = StockBarsRequest(
            symbol_or_symbols=symbol,
            timeframe=tf,
            start=start_date
        )
        bars = stock_data_client.get_stock_bars(request_params)
        return {"symbol": symbol, "bars": [
            {"time": b.timestamp.strftime("%Y-%m-%d"), "open": b.open, "high": b.high, "low": b.low, "close": b.close}
            for b in bars[symbol]
        ]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/quote/{symbol}")
async def get_quote(symbol: str):
    try:
        quote = get_cached_stock_quote(symbol)
        return {"symbol": symbol, "price": quote[symbol].ask_price}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def sanitize_float(v):
    if v is None or np.isnan(v) or np.isinf(v):
        return 0.0
    return float(v)

def get_contract_metrics(contract_symbol, snapshot, spot_price, oi=0):
    """Calculates Greeks (with BS fallback) and Exposure for a contract."""
    greeks_data = getattr(snapshot, 'greeks', None)
    gamma = 0
    delta = 0
    vanna = 0
    charm = 0
    option_type = 'call' if 'C' in contract_symbol else 'put'
    
    # Calculate Greeks using Black-Scholes for Vanna/Charm (and fallback for others)
    try:
        iv = snapshot.implied_volatility or 0.3 
        strike_val = float(contract_symbol[-8:]) / 1000
        exp_str = contract_symbol[4:10]
        exp_date = datetime.strptime(exp_str, "%y%m%d")
        t_days = (exp_date - datetime.now()).days
        T = max(t_days, 1) / 365.0
        
        _, d, g, _, _, v, c = black_scholes(spot_price, strike_val, T, 0.04, iv, option_type)
        vanna = v
        charm = c
        
        if greeks_data and greeks_data.gamma is not None:
            gamma = greeks_data.gamma
            delta = greeks_data.delta or 0
        else:
            delta = d
            gamma = g
    except:
        pass

    gex = sanitize_float(calculate_gex(oi, gamma, spot_price, option_type))
    dex = sanitize_float(calculate_dex(oi, delta, spot_price))
    vanna_exp = sanitize_float(calculate_vanna_exposure(oi, vanna, spot_price))
    charm_exp = sanitize_float(calculate_charm_exposure(oi, charm, spot_price))
    
    return {
        "delta": sanitize_float(delta),
        "gamma": sanitize_float(gamma),
        "vanna": sanitize_float(vanna),
        "charm": sanitize_float(charm),
        "gex": gex,
        "dex": dex,
        "vanna_exp": vanna_exp,
        "charm_exp": charm_exp
    }

def get_oi_fallback(contract_symbol, snapshot, oi_lookup):
    """Consistent OI fallback logic."""
    oi = oi_lookup.get(contract_symbol, 0)
    if oi == 0 and snapshot.latest_trade:
        oi = snapshot.latest_trade.size or 10 
    elif oi == 0:
        oi = 5 
    return int(oi)

@app.get("/api/options/chain/{symbol}")
async def get_option_chain(symbol: str, expiry: str = None):
    try:
        quote = get_cached_stock_quote(symbol)
        spot_price = quote[symbol].ask_price

        # Get OI lookup from trading client for more accurate data
        oi_lookup = {}
        try:
            req = GetOptionContractsRequest(underlying_symbols=[symbol], status="active")
            contracts_resp = trading_client.get_option_contracts(req)
            for c in contracts_resp.option_contracts:
                if c.open_interest:
                    oi_lookup[c.symbol] = int(c.open_interest)
        except:
            pass

        chain = get_cached_option_chain(symbol)
        
        processed_chain = []
        for contract_symbol, snapshot in chain.items():
            if expiry and expiry not in contract_symbol:
                continue
                
            oi = get_oi_fallback(contract_symbol, snapshot, oi_lookup)
            metrics = get_contract_metrics(contract_symbol, snapshot, spot_price, oi)
            
            processed_chain.append({
                "contract": contract_symbol,
                "ask": snapshot.latest_quote.ask_price if snapshot.latest_quote else None,
                "bid": snapshot.latest_quote.bid_price if snapshot.latest_quote else None,
                "last": snapshot.latest_trade.price if snapshot.latest_trade else None,
                "implied_vol": snapshot.implied_volatility,
                "open_interest": oi,
                "greeks": {
                    "delta": metrics["delta"],
                    "gamma": metrics["gamma"]
                },
                "exposure": {
                    "gex": metrics["gex"],
                    "dex": metrics["dex"]
                }
            })

        return {
            "symbol": symbol,
            "spot_price": spot_price,
            "chain": processed_chain
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/options/levels/{symbol}")
async def get_option_levels(symbol: str, expiry: str = None):
    try:
        # Get spot price
        quote = get_cached_stock_quote(symbol)
        spot_price = quote[symbol].ask_price

        # Get OI lookup from trading client (contracts)
        oi_lookup = {}
        try:
            req = GetOptionContractsRequest(underlying_symbols=[symbol], status="active")
            contracts_resp = trading_client.get_option_contracts(req)
            for c in contracts_resp.option_contracts:
                if c.open_interest:
                    oi_lookup[c.symbol] = int(c.open_interest)
        except Exception as e:
            print(f"OI Lookup Error: {e}")

        total_gex = 0
        total_dex = 0
        total_vanna = 0
        total_charm = 0
        strike_data = {} # strike -> detailed metrics
        processed_chain = []
        flip_contracts = []
        
        # Get chain from data client
        chain = get_cached_option_chain(symbol)
        
        for contract_symbol, snapshot in chain.items():
            if expiry and expiry not in contract_symbol:
                continue

            oi = get_oi_fallback(contract_symbol, snapshot, oi_lookup)
            metrics = get_contract_metrics(contract_symbol, snapshot, spot_price, oi)
            
            total_gex += metrics["gex"]
            total_dex += metrics["dex"]
            total_vanna += metrics["vanna_exp"]
            total_charm += metrics["charm_exp"]
            
            try:
                strike = float(contract_symbol[-8:]) / 1000
            except:
                continue

            if strike not in strike_data:
                strike_data[strike] = {
                    "strike": strike,
                    "gex": 0, "dex": 0, "oi": 0,
                    "vanna": 0, "charm": 0,
                    "call_gex": 0, "put_gex": 0,
                    "call_oi": 0, "put_oi": 0,
                    "call_vol": 0, "put_vol": 0,
                    "call_iv": 0, "put_iv": 0
                }
            
            option_type = 'call' if 'C' in contract_symbol else 'put'
            vol = snapshot.latest_trade.size if snapshot.latest_trade else 0
            iv = snapshot.implied_volatility or 0

            strike_data[strike]["gex"] += metrics["gex"]
            strike_data[strike]["dex"] += metrics["dex"]
            strike_data[strike]["oi"] += oi
            strike_data[strike]["vanna"] += metrics["vanna_exp"]
            strike_data[strike]["charm"] += metrics["charm_exp"]

            if option_type == 'call':
                strike_data[strike]["call_gex"] += metrics["gex"]
                strike_data[strike]["call_oi"] += oi
                strike_data[strike]["call_vol"] += vol
                strike_data[strike]["call_iv"] = iv
            else:
                strike_data[strike]["put_gex"] += metrics["gex"]
                strike_data[strike]["put_oi"] += oi
                strike_data[strike]["put_vol"] += vol
                strike_data[strike]["put_iv"] = iv

            processed_chain.append({
                "contract": contract_symbol,
                "open_interest": oi,
                "gex": metrics["gex"]
            })

            # Data for Gamma Flip calculation
            exp_str = contract_symbol[4:10]
            exp_date = datetime.strptime(exp_str, "%y%m%d")
            t_days = (exp_date - datetime.now()).days
            flip_contracts.append({
                "strike": strike,
                "oi": oi,
                "iv": snapshot.implied_volatility or 0.3,
                "T": max(t_days, 1) / 365.0,
                "type": 'call' if 'C' in contract_symbol else 'put'
            })
            
        call_wall, put_wall = identify_walls(processed_chain, spot_price)
        gamma_flip = calculate_gamma_flip(flip_contracts, spot_price)
        max_pain = calculate_max_pain(list(strike_data.values()))
        
        # Calculate expected move for this expiry
        atm_iv = 0.3
        if flip_contracts:
            # Find contract with strike closest to spot
            closest = min(flip_contracts, key=lambda x: abs(x['strike'] - spot_price))
            atm_iv = closest['iv']
            t_days = int(closest['T'] * 365)
            expected_move = calculate_expected_move(spot_price, atm_iv, t_days)
        else:
            expected_move = 0
            
        # Sort strikes for the frontend
        sorted_strikes = sorted(list(strike_data.values()), key=lambda x: x["strike"])

        # Auto-snapshot for historical tracking
        if not expiry: # Only snapshot full chain trends
            save_snapshot(symbol, total_gex, total_dex, call_wall, put_wall, gamma_flip, max_pain)

        return {
            "symbol": symbol,
            "spot_price": spot_price,
            "total_gex": total_gex,
            "total_dex": total_dex,
            "total_vanna": total_vanna,
            "total_charm": total_charm,
            "call_wall": call_wall,
            "put_wall": put_wall,
            "gamma_flip": gamma_flip,
            "max_pain": max_pain,
            "expected_move": expected_move,
            "strikes": sorted_strikes
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/options/gamma-profile/{symbol}")
async def get_gamma_profile(symbol: str, expiry: str = None):
    try:
        # Get spot price
        quote = get_cached_stock_quote(symbol)
        spot_price = quote[symbol].ask_price

        # Get OI lookup
        oi_lookup = {}
        try:
            req = GetOptionContractsRequest(underlying_symbols=[symbol], status="active")
            contracts_resp = trading_client.get_option_contracts(req)
            for c in contracts_resp.option_contracts:
                if c.open_interest:
                    oi_lookup[c.symbol] = int(c.open_interest)
        except:
            pass

        # Get chain
        chain = get_cached_option_chain(symbol)
        
        flip_contracts = []
        for contract_symbol, snapshot in chain.items():
            if expiry and expiry not in contract_symbol:
                continue
            
            try:
                strike = float(contract_symbol[-8:]) / 1000
            except:
                continue

            oi = get_oi_fallback(contract_symbol, snapshot, oi_lookup)
            exp_str = contract_symbol[4:10]
            exp_date = datetime.strptime(exp_str, "%y%m%d")
            t_days = (exp_date - datetime.now()).days
            
            flip_contracts.append({
                "strike": strike,
                "oi": oi,
                "iv": snapshot.implied_volatility or 0.3,
                "T": max(t_days, 1) / 365.0,
                "type": 'call' if 'C' in contract_symbol else 'put'
            })
            
        prices, gex_values = get_gex_profile(flip_contracts, spot_price)
        
        return {
            "symbol": symbol,
            "spot_price": spot_price,
            "profile": [
                {"price": float(p), "gex": float(g)}
                for p, g in zip(prices, gex_values)
            ]
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/options/term-structure/{symbol}")
async def get_term_structure(symbol: str):
    try:
        # Get spot price
        quote = get_cached_stock_quote(symbol)
        spot_price = quote[symbol].ask_price

        # Get full chain
        chain = get_cached_option_chain(symbol)
        
        # Expiration -> list of (strike, iv)
        exp_data = {}
        for contract_symbol, snapshot in chain.items():
            if not snapshot.implied_volatility:
                continue
                
            exp = contract_symbol[4:10] # YYMMDD
            try:
                strike = float(contract_symbol[-8:]) / 1000
            except:
                continue
                
            if exp not in exp_data:
                exp_data[exp] = []
            exp_data[exp].append((strike, snapshot.implied_volatility))
            
        # For each expiration, find ATM IV (closest strike to spot)
        term_structure = []
        now = datetime.now()
        for exp in sorted(exp_data.keys()):
            strikes = exp_data[exp]
            # Find closest to spot
            closest = min(strikes, key=lambda x: abs(x[0] - spot_price))
            
            # Convert YYMMDD to YYYY-MM-DD
            dt = datetime.strptime(exp, "%y%m%d")
            days = (dt - now).days
            
            if days < 0: continue # Skip expired

            term_structure.append({
                "date": dt.strftime("%Y-%m-%d"),
                "days_to_expiry": days,
                "iv": float(closest[1])
            })
            
        return {
            "symbol": symbol,
            "spot_price": spot_price,
            "term_structure": term_structure[:10] # Top 10 expirations
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/options/expiries/{symbol}")
async def get_expiries(symbol: str):
    try:
        # Use the cached option chain to get all available expiries reliably
        chain = get_cached_option_chain(symbol)
        
        # Extract unique expiries from contract symbols (format: ROOTYYMMDD[C/P]STRIKE)
        expiries_set = set()
        for contract_symbol in chain.keys():
            # Expiration date is YYMMDD starting at index len(symbol)
            # Actually, standard OCC symbol format is SYMBOL YYMMDD C/P STRIKE
            # Alpaca symbols usually look like AAPL260515C00150000
            # The date starts after the underlying symbol
            exp = contract_symbol[len(symbol):len(symbol)+6]
            expiries_set.add(exp)
        
        # Sort expiries chronologically
        expiries = sorted(list(expiries_set))

        return {
            "symbol": symbol,
            "expiries": expiries
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/options/gex-heatmap/{symbol}")
async def get_gex_heatmap(symbol: str):
    try:
        # Get spot price
        quote = get_cached_stock_quote(symbol)
        spot_price = quote[symbol].ask_price

        # Get OI lookup
        oi_lookup = {}
        try:
            req = GetOptionContractsRequest(underlying_symbols=[symbol], status="active")
            contracts_resp = trading_client.get_option_contracts(req)
            for c in contracts_resp.option_contracts:
                if c.open_interest:
                    oi_lookup[c.symbol] = int(c.open_interest)
        except:
            pass

        # Get full chain
        chain = get_cached_option_chain(symbol)
        
        # heatmap[expiration][strike] = gex
        heatmap_raw = {}
        
        for contract_symbol, snapshot in chain.items():
            exp = contract_symbol[4:10] # YYMMDD
            try:
                strike = float(contract_symbol[-8:]) / 1000
            except:
                continue
                
            # Filter for strikes +/- 10% around spot
            if abs(strike - spot_price) / spot_price > 0.1:
                continue

            oi = get_oi_fallback(contract_symbol, snapshot, oi_lookup)
            metrics = get_contract_metrics(contract_symbol, snapshot, spot_price, oi)
            
            if exp not in heatmap_raw:
                heatmap_raw[exp] = {}
            
            heatmap_raw[exp][strike] = heatmap_raw[exp].get(strike, 0) + metrics["gex"]
            
        # Format for frontend
        sorted_expiries = sorted(heatmap_raw.keys())[:10] # Next 10 expirations
        
        # Get all relevant strikes
        all_strikes = set()
        for e in sorted_expiries:
            all_strikes.update(heatmap_raw[e].keys())
        
        # Sort and limit strikes to top 20 by absolute total GEX if needed, 
        # but +/- 10% range is usually manageable.
        sorted_strikes = sorted(list(all_strikes))
        
        result = []
        for e in sorted_expiries:
            row = {"expiration": datetime.strptime(e, "%y%m%d").strftime("%Y-%m-%d"), "data": []}
            for s in sorted_strikes:
                row["data"].append({"strike": s, "gex": float(heatmap_raw[e].get(s, 0))})
            result.append(row)
            
        return {
            "symbol": symbol,
            "spot_price": spot_price,
            "strikes": sorted_strikes,
            "expiries": [datetime.strptime(e, "%y%m%d").strftime("%Y-%m-%d") for e in sorted_expiries],
            "heatmap": result
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/options/simulate")
async def simulate_options(S: float, K: float, T_days: int, sigma: float, option_type: str = 'call', r: float = 0.04):
    try:
        T = max(T_days, 1e-5) / 365.0
        # price, delta, gamma, theta, vega, vanna, charm
        res = black_scholes(S, K, T, r, sigma, option_type)
        
        return {
            "price": float(res[0]),
            "delta": float(res[1]),
            "gamma": float(res[2]),
            "theta": float(res[3]),
            "vega": float(res[4]),
            "vanna": float(res[5]),
            "charm": float(res[6])
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/options/history/{symbol}")
async def get_gex_history(symbol: str):
    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute("SELECT * FROM gex_history WHERE symbol=? ORDER BY timestamp ASC", (symbol,))
        rows = c.fetchall()
        conn.close()
        
        history = []
        for r in rows:
            history.append({
                "timestamp": r[0],
                "symbol": r[1],
                "total_gex": r[2],
                "total_dex": r[3],
                "call_wall": r[4],
                "put_wall": r[5],
                "gamma_flip": r[6],
                "max_pain": r[7]
            })
            
        return {"symbol": symbol, "history": history}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat")
async def chat(query: str, context: dict = None):
    try:
        if not client:
            return {"response": "Gemini API key not configured."}
            
        model_id = "gemini-3.1-pro-preview"
        
        # Tools configuration
        tools = [
            get_market_quote,
            get_option_chain_summary,
            get_historical_stock_data,
            types.Tool(google_search=types.GoogleSearchRetrieval())
        ]
        
        config = types.GenerateContentConfig(
            tools=tools,
            tool_config=types.ToolConfig(
                include_server_side_tool_invocations=True
            ),
            system_instruction="You are an expert options trading assistant. You have access to real-time market data via Alpaca and the internet via Google Search. Use these tools to provide accurate and helpful analysis."
        )
        
        # Using chat session for automatic function calling
        chat_session = client.chats.create(model=model_id, config=config)
        prompt = f"User Query: {query}\n\nAdditional Context: {context}"
        
        response = chat_session.send_message(prompt)
        return {"response": response.text}
    except Exception as e:
        print(f"Chat error: {e}")
        # Fallback to simple generation if chat session fails or for simpler debugging
        try:
            response = client.models.generate_content(
                model=model_id,
                contents=prompt,
                config=config
            )
            return {"response": response.text}
        except Exception as e2:
            raise HTTPException(status_code=500, detail=f"Primary Error: {str(e)}. Fallback Error: {str(e2)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5001)
