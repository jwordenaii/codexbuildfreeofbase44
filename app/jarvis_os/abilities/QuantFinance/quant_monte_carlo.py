import math
import random

class QuantMonteCarlo:
    """
    A pure Python implementation for Monte Carlo simulations 
    using Geometric Brownian Motion (GBM).
    """
    def __init__(self, baseline_price: float, volatility: float, drift: float, time_horizon: float = 1.0):
        self.S0 = baseline_price
        self.sigma = volatility
        self.mu = drift
        self.T = time_horizon
        
    def get_risk_bounds(self, num_paths: int = 10000, steps: int = 1) -> tuple:
        dt = self.T / steps
        
        # Precompute constants for optimization outside the simulation loop
        drift_factor = (self.mu - 0.5 * (self.sigma ** 2)) * dt
        vol_factor = self.sigma * math.sqrt(dt)
        
        terminal_prices = []
        
        for _ in range(num_paths):
            price = self.S0
            for _ in range(steps):
                Z = random.gauss(0.0, 1.0)
                price *= math.exp(drift_factor + vol_factor * Z)
            terminal_prices.append(price)
            
        terminal_prices.sort()
        
        p5_idx = int(0.05 * num_paths)
        p95_idx = int(0.95 * num_paths)
        
        return terminal_prices[p5_idx], terminal_prices[p95_idx]
