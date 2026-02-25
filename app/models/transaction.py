from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Transaction(Base):
    """A single financial movement (income or expense) tied to an account."""

    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    account_id: Mapped[int] = mapped_column(Integer, ForeignKey("accounts.id"), nullable=False)
    category_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("categories.id"), nullable=True)

    # Positive = income, Negative = expense (single column keeps queries simple)
    amount: Mapped[float] = mapped_column(Numeric(precision=15, scale=2), nullable=False)
    # Redundant but useful for quick filtering without checking sign of amount
    transaction_type: Mapped[str] = mapped_column(String, nullable=False)  # "income" | "expense"
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    account: Mapped["Account"] = relationship(back_populates="transactions")  # noqa: F821
    category: Mapped["Category | None"] = relationship(back_populates="transactions")  # noqa: F821


class Category(Base):
    """User-defined spending/income categories (e.g. Rent, Salary, Groceries)."""

    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    owner_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    # "income" or "expense" — lets the UI pre-filter category suggestions
    category_type: Mapped[str] = mapped_column(String, nullable=False, default="expense")
    color: Mapped[str | None] = mapped_column(String(7), nullable=True)  # hex color e.g. "#FF5733"

    owner: Mapped["User"] = relationship(back_populates="categories")  # noqa: F821
    transactions: Mapped[list["Transaction"]] = relationship(back_populates="category")
