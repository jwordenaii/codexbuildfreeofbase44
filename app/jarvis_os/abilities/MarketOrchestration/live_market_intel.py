import logging
import requests
from datetime import datetime

logger = logging.getLogger(__name__)

class LiveMarketIntelEngine:
    """
    Autonomous Engine for scraping live global commodity spot prices.
    Tracks WTI Crude Oil (CL=F) and US Midwest Hot-Rolled Coil Steel (HRC=F).
    """
    def __init__(self):
        self.module_id = "live_market_intel"
        self.cache = {}
        self.last_fetch = None
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        }
        
        # Baseline prices to calculate multipliers
        # Using historical averages for baseline. If live price > baseline, multiplier > 1.0
        self.baseline_oil = 75.00 # $75/bbl
        self.baseline_steel = 900.00 # $900/ton

    def fetch_ticker(self, ticker: str) -> float:
        try:
            url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
            res = requests.get(url, headers=self.headers, timeout=5)
            if res.status_code == 200:
                data = res.json()
                price = data['chart']['result'][0]['meta']['regularMarketPrice']
                return float(price)
        except Exception as e:
            logger.warning(f"Failed to fetch live data for {ticker}: {e}")
        return None

    def execute(self, params: dict = None) -> dict:
        """
        Fetches live commodities, calculates multiplier relative to baseline.
        """
        # Cache for 1 hour to prevent rate limiting
        if self.last_fetch and (datetime.utcnow() - self.last_fetch).total_seconds() < 3600:
            return self.cache
            
        oil_price = self.fetch_ticker("CL=F") or self.baseline_oil
        steel_price = self.fetch_ticker("HRC=F") or self.baseline_steel
        
        oil_multiplier = oil_price / self.baseline_oil
        steel_multiplier = steel_price / self.baseline_steel
        
        self.cache = {
            "status": "success",
            "oil_price": round(oil_price, 2),
            "oil_multiplier": round(oil_multiplier, 4),
            "steel_price": round(steel_price, 2),
            "steel_multiplier": round(steel_multiplier, 4),
            "timestamp": datetime.utcnow().isoformat()
        }
        self.last_fetch = datetime.utcnow()
        
        return self.cache
