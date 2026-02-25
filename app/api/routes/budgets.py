from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.budget import Budget
from app.models.transaction import Category, Transaction
from app.models.user import User
from app.schemas.budget import BudgetCreate, BudgetRead, BudgetStatus, BudgetUpdate
from app.services.auth import get_current_user

router = APIRouter(prefix="/budgets", tags=["budgets"])


def _get_budget_or_404(budget_id: int, user: User, db: Session) -> Budget:
    b = db.get(Budget, budget_id)
    if not b or b.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Budget not found")
    return b


@router.get("/", response_model=list[BudgetRead])
def list_budgets(
    year: int | None = Query(None),
    month: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(Budget).filter(Budget.owner_id == current_user.id)
    if year:
        q = q.filter(Budget.year == year)
    if month:
        q = q.filter(Budget.month == month)
    return q.all()


@router.post("/", response_model=BudgetRead, status_code=201)
def create_budget(
    payload: BudgetCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify the category belongs to the user
    cat = db.get(Category, payload.category_id)
    if not cat or cat.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Category not found")

    existing = (
        db.query(Budget)
        .filter(
            Budget.owner_id == current_user.id,
            Budget.category_id == payload.category_id,
            Budget.year == payload.year,
            Budget.month == payload.month,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=400, detail="Budget already exists for this category/month"
        )

    budget = Budget(**payload.model_dump(), owner_id=current_user.id)
    db.add(budget)
    db.commit()
    db.refresh(budget)
    return budget


@router.patch("/{budget_id}", response_model=BudgetRead)
def update_budget(
    budget_id: int,
    payload: BudgetUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    budget = _get_budget_or_404(budget_id, current_user, db)
    budget.amount = payload.amount
    db.commit()
    db.refresh(budget)
    return budget


@router.delete("/{budget_id}", status_code=204)
def delete_budget(
    budget_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    budget = _get_budget_or_404(budget_id, current_user, db)
    db.delete(budget)
    db.commit()


@router.get("/status", response_model=list[BudgetStatus])
def budget_status(
    year: int | None = Query(None),
    month: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    year = year or now.year
    month = month or now.month

    budgets = (
        db.query(Budget)
        .filter(
            Budget.owner_id == current_user.id,
            Budget.year == year,
            Budget.month == month,
        )
        .all()
    )

    # Get all accounts owned by the user for filtering transactions
    from app.models.account import Account

    owned_account_ids = [
        r[0]
        for r in db.query(Account.id).filter(Account.owner_id == current_user.id).all()
    ]

    result = []
    for b in budgets:
        # Sum expenses for this category in the given month
        spent_raw = (
            db.query(func.coalesce(func.sum(Transaction.amount), 0))
            .filter(
                Transaction.account_id.in_(owned_account_ids),
                Transaction.category_id == b.category_id,
                Transaction.transaction_type == "expense",
                func.strftime("%Y", Transaction.date) == str(year),
                func.strftime("%m", Transaction.date) == f"{month:02d}",
            )
            .scalar()
        )
        from decimal import Decimal

        budget_amt = Decimal(str(b.amount))
        spent = abs(Decimal(str(spent_raw)))
        remaining = budget_amt - spent
        percent_used = float(spent / budget_amt * 100) if budget_amt > 0 else 0.0

        result.append(
            BudgetStatus(
                category_id=b.category_id,
                category_name=b.category.name,
                budget=budget_amt,
                spent=spent,
                remaining=remaining,
                percent_used=round(percent_used, 1),
                over_budget=spent > budget_amt,
            )
        )

    return result
