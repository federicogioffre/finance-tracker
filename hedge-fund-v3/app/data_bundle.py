from dataclasses import dataclass, field
from app.data_sources import fetch_market_data, fetch_news, fetch_fundamentals
from app.logging import get_logger
from app.version import DATA_VERSION

logger = get_logger(__name__)

_FALLBACK_MARKET = {"symbol": "UNKNOWN", "price": 0, "change_percent": 0, "volume": 0}
_FALLBACK_FUNDAMENTALS = {"pe_ratio": 0, "roe": 0, "revenue_growth": 0, "profit_margin": 0}


@dataclass
class DataBundle:
    ticker: str
    market_data: dict = field(default_factory=dict)
    news: list[dict] = field(default_factory=list)
    fundamentals: dict = field(default_factory=dict)
    version: str = DATA_VERSION
    _loaded: bool = False

    async def load(self) -> "DataBundle":
        if self._loaded:
            return self

        logger.info("Loading data bundle", ticker=self.ticker, version=self.version)

        try:
            self.market_data = await fetch_market_data(self.ticker)
        except Exception as e:
            logger.warning("fallback_used", source="market_data", ticker=self.ticker, error=str(e))
            self.market_data = {**_FALLBACK_MARKET, "symbol": self.ticker}

        try:
            self.news = await fetch_news(self.ticker)
        except Exception as e:
            logger.warning("fallback_used", source="news", ticker=self.ticker, error=str(e))
            self.news = []

        try:
            self.fundamentals = await fetch_fundamentals(self.ticker)
        except Exception as e:
            logger.warning("fallback_used", source="fundamentals", ticker=self.ticker, error=str(e))
            self.fundamentals = {**_FALLBACK_FUNDAMENTALS, "symbol": self.ticker}

        self._loaded = True
        logger.info("Data bundle loaded", ticker=self.ticker)
        return self

    def to_dict(self) -> dict:
        return {
            "ticker": self.ticker,
            "market_data": self.market_data,
            "news": self.news,
            "fundamentals": self.fundamentals,
            "version": self.version,
        }
