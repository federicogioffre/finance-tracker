from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.account import Account
from app.models.transaction import Category, Transaction
from app.models.user import User
from app.schemas.transaction import (
    CategoryCreate,
    CategoryRead,
    SummaryRead,
    TransactionCreate,
    TransactionRead,
    TransactionUpdate,
)
from app.services.auth import get_current_user

router = APIRouter(tags=["transactions"])


# ── Categories ──────────────────────────────────────────────────────────────

@router.get("/categories", response_model=list[CategoryRead])
def list_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(Category).filter(Category.owner_id == current_user.id).all()


@router.post("/categories", response_model=CategoryRead, status_code=201)
def create_category(
    payload: CategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cat = Category(**payload.model_dump(), owner_id=current_user.id)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


# ── Transactions ─────────────────────────────────────────────────────────────

def _owned_account_ids(user: User, db: Session) -> list[int]:
    rows = db.query(Account.id).filter(Account.owner_id == user.id).all()
    return [r[0] for r in rows]


@router.get("/transactions", response_model=list[TransactionRead])
def list_transactions(
    account_id: int | None = Query(None),
    transaction_type: str | None = Query(None),
    start_date: datetime | None = Query(None),
    end_date: datetime | None = Query(None),
    limit: int = Query(50, le=500),
    offset: int = Query(0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    owned = _owned_account_ids(current_user, db)
    q = db.query(Transaction).filter(Transaction.account_id.in_(owned))

    if account_id:
        if account_id not in owned:
            raise HTTPException(status_code=403, detail="Not your account")
        q = q.filter(Transaction.account_id == account_id)
    if transaction_type:
        q = q.filter(Transaction.transaction_type == transaction_type)
    if start_date:
        q = q.filter(Transaction.date >= start_date)
    if end_date:
        q = q.filter(Transaction.date <= end_date)

    return q.order_by(Transaction.date.desc()).offset(offset).limit(limit).all()


@router.post("/transactions", response_model=TransactionRead, status_code=201)
def create_transaction(
    payload: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    owned = _owned_account_ids(current_user, db)
    if payload.account_id not in owned:
        raise HTTPException(status_code=403, detail="Not your account")

    tx = Transaction(**payload.model_dump())
    db.add(tx)

    # Update account balance atomically in the same transaction
    account = db.get(Account, payload.account_id)
    account.balance = float(account.balance) + float(payload.amount)

    db.commit()
    db.refresh(tx)
    return tx


@router.get("/transactions/summary", response_model=SummaryRead)
def get_summary(
    account_id: int | None = Query(None),
    start_date: datetime | None = Query(None),
    end_date: datetime | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    owned = _owned_account_ids(current_user, db)
    q = db.query(Transaction).filter(Transaction.account_id.in_(owned))

    if account_id:
        if account_id not in owned:
            raise HTTPException(status_code=403, detail="Not your account")
        q = q.filter(Transaction.account_id == account_id)
    if start_date:
        q = q.filter(Transaction.date >= start_date)
    if end_date:
        q = q.filter(Transaction.date <= end_date)

    income = q.filter(Transaction.transaction_type == "income").with_entities(
        func.coalesce(func.sum(Transaction.amount), 0)
    ).scalar()

    expenses = q.filter(Transaction.transaction_type == "expense").with_entities(
        func.coalesce(func.sum(Transaction.amount), 0)
    ).scalar()

    income = Decimal(str(income))
    expenses = Decimal(str(expenses))  # stored as negative

    return SummaryRead(
        total_income=income,
        total_expenses=abs(expenses),
        net=income + expenses,
        period_start=start_date,
        period_end=end_date,
    )


@router.get("/transactions/{tx_id}", response_model=TransactionRead)
def get_transaction(
    tx_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    owned = _owned_account_ids(current_user, db)
    tx = db.get(Transaction, tx_id)
    if not tx or tx.account_id not in owned:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return tx


@router.patch("/transactions/{tx_id}", response_model=TransactionRead)
def update_transaction(
    tx_id: int,
    payload: TransactionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    owned = _owned_account_ids(current_user, db)
    tx = db.get(Transaction, tx_id)
    if not tx or tx.account_id not in owned:
        raise HTTPException(status_code=404, detail="Transaction not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(tx, field, value)
    db.commit()
    db.refresh(tx)
    return tx


@router.delete("/transactions/{tx_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(
    tx_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    owned = _owned_account_ids(current_user, db)
    tx = db.get(Transaction, tx_id)
    if not tx or tx.account_id not in owned:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Reverse the balance effect before deleting
    account = db.get(Account, tx.account_id)
    account.balance = float(account.balance) - float(tx.amount)

    db.delete(tx)
    db.commit()
