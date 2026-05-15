import os
from alpaca.data.historical import OptionHistoricalDataClient
from alpaca.data.requests import OptionChainRequest
from alpaca.trading.client import TradingClient
from alpaca.trading.requests import GetOptionContractsRequest
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("ALPACA_API_KEY")
SECRET_KEY = os.getenv("ALPACA_SECRET_KEY")

data_client = OptionHistoricalDataClient(API_KEY, SECRET_KEY)
trading_client = TradingClient(API_KEY, SECRET_KEY, paper=True)

symbol = "ARMK"
expiry = "260618"

# Get OI lookup from trading client
oi_lookup = {}
req = GetOptionContractsRequest(underlying_symbols=[symbol], status="active")
contracts_resp = trading_client.get_option_contracts(req)
for c in contracts_resp.option_contracts:
    if expiry in c.symbol:
        oi_lookup[c.symbol] = c.open_interest

chain_request = OptionChainRequest(underlying_symbol=symbol)
chain = data_client.get_option_chain(chain_request)

strikes_of_interest = [42.0, 47.0, 55.0, 60.0]
results = {s: {"call_oi": 0, "put_oi": 0, "call_contracts": [], "put_contracts": []} for s in strikes_of_interest}

for contract_symbol, snapshot in chain.items():
    if expiry not in contract_symbol:
        continue
        
    strike = float(contract_symbol[-8:]) / 1000
    if strike in strikes_of_interest:
        is_call = 'C' in contract_symbol
        oi = oi_lookup.get(contract_symbol)
        # Fallback to trade size if OI is None (same as main logic)
        final_oi = int(oi) if oi else (snapshot.latest_trade.size if snapshot.latest_trade else 5)
        
        if is_call:
            results[strike]["call_oi"] += final_oi
            results[strike]["call_contracts"].append(contract_symbol)
        else:
            results[strike]["put_oi"] += final_oi
            results[strike]["put_contracts"].append(contract_symbol)

print(f"{'Strike':<10} {'Call OI':<10} {'Put OI':<10}")
for s in sorted(results.keys()):
    print(f"{s:<10} {results[s]['call_oi']:<10} {results[s]['put_oi']:<10}")
