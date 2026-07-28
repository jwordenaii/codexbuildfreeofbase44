import math
import random

class DynamicAuctionBidder:
    """
    A High-Frequency Bidding agent using Thompson Sampling and Upper Confidence Bound (UCB).
    Maximizes Expected Profit in programmatic B2G auctions.
    """
    
    def __init__(self, bid_levels=None, strategy="thompson", ucb_c=1.414, monotonic_updates=True):
        self.bid_levels = sorted(bid_levels) if bid_levels else [i / 20.0 for i in range(1, 21)]
        self.strategy = strategy.lower()
        self.ucb_c = ucb_c
        self.monotonic_updates = monotonic_updates
        
        # Thompson Sampling state
        self.alphas = {level: 1.0 for level in self.bid_levels}
        self.betas = {level: 1.0 for level in self.bid_levels}
        
        # UCB state
        self.counts = {level: 0 for level in self.bid_levels}
        self.wins = {level: 0 for level in self.bid_levels}
        self.total_bids = 0

    def get_bid(self, item_value: float) -> float:
        if item_value <= 0: return 0.0

        best_level = self.bid_levels[0]
        max_expected_profit = -float('inf')
        
        for level in self.bid_levels:
            profit_margin = item_value - (item_value * level)
            
            if self.strategy == "thompson":
                win_prob = random.betavariate(self.alphas[level], self.betas[level])
            elif self.strategy == "ucb":
                if self.counts[level] == 0:
                    win_prob = 1.0
                else:
                    empirical_win_rate = self.wins[level] / self.counts[level]
                    exploration_bonus = self.ucb_c * math.sqrt(math.log(self.total_bids) / self.counts[level])
                    win_prob = min(1.0, empirical_win_rate + exploration_bonus)
            else:
                raise ValueError("Strategy must be 'thompson' or 'ucb'")

            expected_profit = win_prob * profit_margin
            
            if expected_profit > max_expected_profit:
                max_expected_profit = expected_profit
                best_level = level
                
        return item_value * best_level

    def update(self, item_value: float, bid_placed: float, won_auction: bool):
        if item_value <= 0: return
            
        fraction = bid_placed / item_value
        closest_level = min(self.bid_levels, key=lambda f: abs(f - fraction))
        
        self.total_bids += 1
        self.counts[closest_level] += 1
        
        if won_auction:
            self.alphas[closest_level] += 1.0
            self.wins[closest_level] += 1
            if self.monotonic_updates:
                for level in self.bid_levels:
                    if level > closest_level:
                        self.alphas[level] += 0.5
                        self.wins[level] += 0.5
                        self.counts[level] += 0.5
        else:
            self.betas[closest_level] += 1.0
            if self.monotonic_updates:
                for level in self.bid_levels:
                    if level < closest_level:
                        self.betas[level] += 0.5
                        self.counts[level] += 0.5
