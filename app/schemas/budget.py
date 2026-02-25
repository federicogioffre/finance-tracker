from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, field_validator


class BudgetCreate(BaseModel):
    category_id: int
    amount: Decimal
    year: int
    month: int

    @field_validator("month")
    @classmethod
    def valid_month(cls, v: int) -> int:
        if not 1 <= v <= 12:
            raise ValueError("month must be between 1 and 12")
        return v


class BudgetUpdate(BaseModel):
    amount: Decimal


class BudgetRead(BaseModel):
    id: int
    owner_id: int
    category_id: int
    amount: Decimal
    year: int
    month: int
    created_at: datetime

    model_config = {"from_attributes": True}


class BudgetStatus(BaseModel):
    """Spent vs. limit for a single category in a given month."""

    category_id: int
    category_name: str
    budget: Decimal
    spent: Decimal
    remaining: Decimal
    percent_used: float
    over_budget: bool
