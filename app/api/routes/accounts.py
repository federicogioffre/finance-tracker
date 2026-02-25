from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.account import Account
from app.models.user import User
from app.schemas.account import AccountCreate, AccountRead, AccountUpdate
from app.services.auth import get_current_user

router = APIRouter(prefix="/accounts", tags=["accounts"])


def _get_account_or_404(account_id: int, user: User, db: Session) -> Account:
    account = db.get(Account, account_id)
    if not account or account.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


@router.get("/", response_model=list[AccountRead])
def list_accounts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(Account).filter(Account.owner_id == current_user.id).all()


@router.post("/", response_model=AccountRead, status_code=status.HTTP_201_CREATED)
def create_account(
    payload: AccountCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = Account(**payload.model_dump(), owner_id=current_user.id)
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


@router.get("/{account_id}", response_model=AccountRead)
def get_account(
    account_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _get_account_or_404(account_id, current_user, db)


@router.patch("/{account_id}", response_model=AccountRead)
def update_account(
    account_id: int,
    payload: AccountUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = _get_account_or_404(account_id, current_user, db)
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(account, field, value)
    db.commit()
    db.refresh(account)
    return account


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    account_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = _get_account_or_404(account_id, current_user, db)
    db.delete(account)
    db.commit()
