from contextvars import ContextVar
from uuid import uuid4

request_id_var: ContextVar[str] = ContextVar("request_id", default="")
ticker_var: ContextVar[str] = ContextVar("ticker", default="")


def new_request_id() -> str:
    rid = uuid4().hex[:12]
    request_id_var.set(rid)
    return rid


def set_ticker(ticker: str) -> None:
    ticker_var.set(ticker.upper())


def get_request_id() -> str:
    return request_id_var.get()


def get_ticker() -> str:
    return ticker_var.get()
