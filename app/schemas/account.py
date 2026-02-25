from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel

ACCOUNT_TYPES = {"checking", "savings", "credit", "investment", "cash"}


class AccountCreate(BaseModel):
    name: str
    account_type: str = "checking"
    balance: Decimal = Decimal("0.00")
    currency: str = "USD"


class AccountUpdate(BaseModel):
    name: str | None = None
    account_type: str | None = None
    currency: str | None = None


class AccountRead(BaseModel):
    id: int
    owner_id: int
    name: str
    account_type: str
    balance: Decimal
    currency: str
    created_at: datetime

    model_config = {"from_attributes": True}
