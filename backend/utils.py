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
            return max(0, S - K), 0, 0, 0, 0
        else:
            return max(0, K - S), 0, 0, 0, 0
            
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
    
    return price, delta, gamma, theta, vega

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

def identify_walls(chain_data, spot_price):
    """
    Identifies Call Wall and Put Wall based on GEX peaks relative to spot.
    Call Wall: Max GEX peak above spot.
    Put Wall: Min GEX peak below spot.
    """
    strike_gex = {}
    
    for contract in chain_data:
        strike = float(contract['contract'][-8:]) / 1000
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
