from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, model_validator


class CategoryCreate(BaseModel):
    name: str
    category_type: str = "expense"
    color: str | None = None


class CategoryRead(BaseModel):
    id: int
    owner_id: int
    name: str
    category_type: str
    color: str | None

    model_config = {"from_attributes": True}


class TransactionCreate(BaseModel):
    account_id: int
    category_id: int | None = None
    amount: Decimal
    transaction_type: str  # "income" | "expense"
    description: str | None = None
    date: datetime | None = None

    @model_validator(mode="after")
    def normalize_amount(self) -> "TransactionCreate":
        """Expenses are stored as negative values for arithmetic convenience."""
        if self.transaction_type == "expense" and self.amount > 0:
            self.amount = -self.amount
        elif self.transaction_type == "income" and self.amount < 0:
            self.amount = -self.amount
        return self


class TransactionUpdate(BaseModel):
    category_id: int | None = None
    description: str | None = None
    date: datetime | None = None


class TransactionRead(BaseModel):
    id: int
    account_id: int
    category_id: int | None
    amount: Decimal
    transaction_type: str
    description: str | None
    date: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


class SummaryRead(BaseModel):
    total_income: Decimal
    total_expenses: Decimal
    net: Decimal
    period_start: datetime | None
    period_end: datetime | None
