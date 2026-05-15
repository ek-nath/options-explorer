import numpy as np
from scipy.stats import norm

def black_scholes(S, K, T, r, sigma, option_type='call'):
    """
    S: spot price
    K: strike price
    T: time to expiration (in years)
    r: risk-free rate
    sigma: volatility
    """
    if T <= 0:
        if option_type == 'call':
            return max(0, S - K), 0, 0, 0, 0, 0, 0
        else:
            return max(0, K - S), 0, 0, 0, 0, 0, 0
            
    # Safety floors for robustness
    sigma = max(sigma, 1e-5)
    T = max(T, 1e-5)
            
    d1 = (np.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * np.sqrt(T))
    d2 = d1 - sigma * np.sqrt(T)
    
    if option_type == 'call':
        price = S * norm.cdf(d1) - K * np.exp(-r * T) * norm.cdf(d2)
        delta = norm.cdf(d1)
    else:
        price = K * np.exp(-r * T) * norm.cdf(-d2) - S * norm.cdf(-d1)
        delta = norm.cdf(d1) - 1
        
    gamma = norm.pdf(d1) / (S * sigma * np.sqrt(T))
    vega = S * norm.pdf(d1) * np.sqrt(T)
    
    theta_call = -(S * norm.pdf(d1) * sigma) / (2 * np.sqrt(T)) - r * K * np.exp(-r * T) * norm.cdf(d2)
    theta_put = -(S * norm.pdf(d1) * sigma) / (2 * np.sqrt(T)) + r * K * np.exp(-r * T) * norm.cdf(-d2)
    
    theta = theta_call if option_type == 'call' else theta_put
    
    # Second order greeks
    vanna = (vega / S) * (1 - d1 / (sigma * np.sqrt(T)))
    
    # Charm (Delta decay)
    charm_common = norm.pdf(d1) * (r / (sigma * np.sqrt(T)) - d2 / (2 * T))
    if option_type == 'call':
        charm = -(charm_common + r * norm.cdf(d1))
    else:
        charm = -(charm_common - r * norm.cdf(-d1))
        
    return price, delta, gamma, theta, vega, vanna, charm

def calculate_gex(oi, gamma, spot_price, option_type='call'):
    """
    Standard GEX formula (Gamma Dollars per 1% move): 
    GEX = Gamma * OI * 100 * Spot^2 * 0.01
    Signed: Calls (+) , Puts (-)
    """
    val = oi * gamma * (spot_price ** 2) * 1 
    return val if option_type == 'call' else -val

def calculate_dex(oi, delta, spot_price):
    """
    Standard DEX formula (Delta Dollars):
    DEX = Delta * OI * 100 * Spot
    Naturally signed: Calls (+), Puts (-)
    """
    return oi * delta * spot_price * 100

def calculate_vanna_exposure(oi, vanna, spot_price):
    """
    Vanna Exposure: Change in Delta Dollars per 1% move in IV.
    """
    return oi * vanna * spot_price * 100 * 0.01

def calculate_charm_exposure(oi, charm, spot_price):
    """
    Charm Exposure: Change in Delta Dollars per day.
    """
    return oi * (charm / 365.0) * spot_price * 100

def identify_walls(chain_data, spot_price):
    """
    Identifies Call Wall and Put Wall based on GEX peaks relative to spot.
    Call Wall: Max GEX peak above spot.
    Put Wall: Min GEX peak below spot.
    """
    strike_gex = {}
    
    for contract in chain_data:
        try:
            # Handle both dict with 'contract' key and dict with 'strike' key
            if 'contract' in contract:
                strike = float(contract['contract'][-8:]) / 1000
            else:
                strike = float(contract['strike'])
        except:
            continue
            
        gex = contract.get('gex', 0)
        strike_gex[strike] = strike_gex.get(strike, 0) + gex
            
    # Filter by spot
    above_spot = {s: g for s, g in strike_gex.items() if s >= spot_price}
    below_spot = {s: g for s, g in strike_gex.items() if s < spot_price}
    
    call_wall = max(above_spot, key=above_spot.get) if above_spot else None
    put_wall = min(below_spot, key=below_spot.get) if below_spot else None
    
    # Fallback if no peaks on one side
    if not call_wall:
        call_wall = max(strike_gex, key=strike_gex.get) if strike_gex else None
    if not put_wall:
        put_wall = min(strike_gex, key=strike_gex.get) if strike_gex else None
        
    return call_wall, put_wall

def calculate_gamma_flip(contracts, spot_price, r=0.04):
    """
    Finds the spot price where Net GEX crosses zero.
    contracts: list of dicts with {strike, oi, iv, T, type}
    """
    prices, gex_values = get_gex_profile(contracts, spot_price, r)
    
    # Find zero crossing
    for i in range(len(gex_values) - 1):
        if (gex_values[i] > 0 and gex_values[i+1] < 0) or (gex_values[i] < 0 and gex_values[i+1] > 0):
            # Linear interpolation
            p1, p2 = prices[i], prices[i+1]
            g1, g2 = gex_values[i], gex_values[i+1]
            flip_price = p1 - g1 * (p2 - p1) / (g2 - g1)
            return float(flip_price)
            
    return None

def calculate_max_pain(strike_data):
    """
    Finds the strike price where the total intrinsic value of options at expiration is minimized.
    strike_data: list of dicts with {strike, call_oi, put_oi}
    """
    if not strike_data:
        return None
        
    strikes = sorted([s['strike'] for s in strike_data])
    
    max_pain_strike = None
    min_pain = float('inf')
    
    for test_strike in strikes:
        total_pain = 0
        for s in strike_data:
            # Call pain: intrinsic value if test_strike > s['strike']
            if test_strike > s['strike']:
                total_pain += (test_strike - s['strike']) * (s.get('call_oi', 0) or 0)
            # Put pain: intrinsic value if test_strike < s['strike']
            elif test_strike < s['strike']:
                total_pain += (s['strike'] - test_strike) * (s.get('put_oi', 0) or 0)
        
        if total_pain < min_pain:
            min_pain = total_pain
            max_pain_strike = test_strike
            
    return max_pain_strike

def calculate_expected_move(spot_price, atm_iv, days_to_expiry):
    """
    Standard formula for expected move: Spot * IV * sqrt(T/365)
    """
    if days_to_expiry <= 0:
        return 0.0
    T = days_to_expiry / 365.0
    move = spot_price * atm_iv * np.sqrt(T)
    return float(move)

def get_gex_profile(contracts, spot_price, r=0.04):
    """
    Generates a series of (price, net_gex) points.
    """
    def get_net_gex(test_price):
        net_gex = 0
        for c in contracts:
            # Update unpacking to handle 7 return values
            _, _, gamma, _, _, _, _ = black_scholes(test_price, c['strike'], c['T'], r, c['iv'], c['type'])
            gex = calculate_gex(c['oi'], gamma, test_price, c['type'])
            net_gex += gex
        return net_gex

    # Search range: +/- 20% of spot
    prices = np.linspace(spot_price * 0.8, spot_price * 1.2, 50)
    gex_values = [get_net_gex(p) for p in prices]
    return prices, gex_values
