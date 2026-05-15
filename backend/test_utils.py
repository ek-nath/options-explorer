import unittest
import numpy as np
from utils import black_scholes

class TestUtils(unittest.TestCase):
    def test_black_scholes_robustness(self):
        S = 100
        K = 100
        T = 1/365
        r = 0.05
        
        # Test sigma = 0
        sigma = 0
        price, delta, gamma, theta, vega = black_scholes(S, K, T, r, sigma)
        self.assertFalse(np.isnan(gamma))
        self.assertEqual(gamma, 0.0)
        
        # Test T = 0
        T_zero = 0
        sigma_val = 0.2
        price, delta, gamma, theta, vega = black_scholes(S, K, T_zero, r, sigma_val)
        self.assertEqual(price, 0) # At the money, T=0, call price should be 0 (intrinsic)
        self.assertEqual(gamma, 0)
        
        # Test very small T
        T_small = 1e-9
        price, delta, gamma, theta, vega = black_scholes(S, K, T_small, r, sigma_val)
        self.assertFalse(np.isnan(price))
        self.assertFalse(np.isnan(gamma))

    def test_black_scholes_values(self):
        # Known values for a call option
        S = 100
        K = 100
        T = 1
        r = 0.05
        sigma = 0.2
        
        price, delta, gamma, theta, vega = black_scholes(S, K, T, r, sigma, option_type='call')
        
        # Roughly: Price ~ 10.45, Delta ~ 0.637
        self.assertAlmostEqual(price, 10.45058, places=4)
        self.assertAlmostEqual(delta, 0.63683, places=4)

    def test_calculate_gamma_flip(self):
        from utils import calculate_gamma_flip
        spot_price = 100
        contracts = [
            {"strike": 90, "oi": 100, "iv": 0.2, "T": 0.1, "type": "call"},
            {"strike": 110, "oi": 100, "iv": 0.2, "T": 0.1, "type": "put"}
        ]
        # With equal calls at 90 and puts at 110, the flip should be around 100
        flip = calculate_gamma_flip(contracts, spot_price)
        self.assertIsNotNone(flip)
        self.assertGreater(flip, 80)
        self.assertLess(flip, 120)

    def test_get_gex_profile(self):
        from utils import get_gex_profile
        spot_price = 100
        contracts = [
            {"strike": 100, "oi": 100, "iv": 0.2, "T": 0.1, "type": "call"}
        ]
        prices, gex_values = get_gex_profile(contracts, spot_price)
        self.assertEqual(len(prices), 50)
        self.assertEqual(len(gex_values), 50)
        self.assertTrue(all(g > 0 for g in gex_values)) # All calls, GEX should be positive

if __name__ == '__main__':
    unittest.main()
