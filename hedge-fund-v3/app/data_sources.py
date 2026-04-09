import httpx
from app.config import get_settings
from app.logging import get_logger

logger = get_logger(__name__)


async def fetch_market_data(ticker: str) -> dict:
    settings = get_settings()
    if not settings.alpha_vantage_api_key:
        logger.warning("No Alpha Vantage API key, returning mock market data", ticker=ticker)
        return _mock_market_data(ticker)

    url = "https://www.alphavantage.co/query"
    params = {
        "function": "GLOBAL_QUOTE",
        "symbol": ticker,
        "apikey": settings.alpha_vantage_api_key,
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        return resp.json()


async def fetch_news(ticker: str) -> list[dict]:
    settings = get_settings()
    if not settings.news_api_key:
        logger.warning("No News API key, returning mock news", ticker=ticker)
        return _mock_news(ticker)

    url = "https://newsapi.org/v2/everything"
    params = {
        "q": ticker,
        "sortBy": "publishedAt",
        "pageSize": 10,
        "apiKey": settings.news_api_key,
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()
        return data.get("articles", [])


async def fetch_fundamentals(ticker: str) -> dict:
    settings = get_settings()
    if not settings.finnhub_api_key:
        logger.warning("No Finnhub API key, returning mock fundamentals", ticker=ticker)
        return _mock_fundamentals(ticker)

    url = f"https://finnhub.io/api/v1/stock/metric"
    params = {
        "symbol": ticker,
        "metric": "all",
        "token": settings.finnhub_api_key,
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        return resp.json()


def _mock_market_data(ticker: str) -> dict:
    return {
        "symbol": ticker,
        "price": 150.0,
        "change_percent": 1.25,
        "volume": 50_000_000,
        "high": 152.0,
        "low": 148.0,
        "open": 149.0,
        "previous_close": 148.15,
    }


def _mock_news(ticker: str) -> list[dict]:
    return [
        {
            "title": f"{ticker} reports strong quarterly earnings",
            "sentiment": "positive",
            "source": "mock",
            "published": "2026-01-01T00:00:00Z",
        },
        {
            "title": f"Analysts upgrade {ticker} to buy",
            "sentiment": "positive",
            "source": "mock",
            "published": "2026-01-01T00:00:00Z",
        },
        {
            "title": f"{ticker} faces regulatory scrutiny",
            "sentiment": "negative",
            "source": "mock",
            "published": "2026-01-01T00:00:00Z",
        },
    ]


def _mock_fundamentals(ticker: str) -> dict:
    return {
        "symbol": ticker,
        "pe_ratio": 25.4,
        "pb_ratio": 6.8,
        "debt_to_equity": 1.2,
        "roe": 0.35,
        "revenue_growth": 0.12,
        "profit_margin": 0.21,
        "market_cap": 2_500_000_000_000,
        "dividend_yield": 0.006,
    }
