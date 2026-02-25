import io
from datetime import datetime

import openpyxl
from fastapi import APIRouter, Depends, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.account import Account
from app.models.transaction import Transaction
from app.models.user import User
from app.services.auth import get_current_user
from app.services.fineco_parser import parse_fineco_excel

router = APIRouter(prefix="/import", tags=["import"])

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


class ImportPreviewRow(BaseModel):
    date: str
    description: str | None
    amount: float
    transaction_type: str


class ImportPreviewResponse(BaseModel):
    rows: list[ImportPreviewRow]
    total_income: float
    total_expenses: float


class ImportConfirmRequest(BaseModel):
    account_id: int
    rows: list[ImportPreviewRow]


class ImportConfirmResponse(BaseModel):
    imported: int


@router.post("/inspect")
async def inspect_file(
    file: UploadFile,
    current_user: User = Depends(get_current_user),
):
    """Return the first 15 rows of the uploaded file (values only) for debugging."""
    content = await file.read()
    wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
    ws = wb.active
    rows = []
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        rows.append([str(c) if c is not None else "" for c in row])
        if i >= 14:
            break
    return {"sheet": ws.title, "rows": rows}


@router.post("/preview", response_model=ImportPreviewResponse)
async def preview_import(
    file: UploadFile,
    current_user: User = Depends(get_current_user),
):
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(
            status_code=400, detail="Carica un file Excel (.xlsx o .xls)"
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File troppo grande (max 10 MB)")

    try:
        rows = parse_fineco_excel(content)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    if not rows:
        raise HTTPException(
            status_code=422, detail="Nessuna transazione trovata nel file."
        )

    preview_rows = [
        ImportPreviewRow(
            date=r["date"].strftime("%Y-%m-%d"),
            description=r["description"],
            amount=float(r["amount"]),
            transaction_type=r["transaction_type"],
        )
        for r in rows
    ]

    total_income = sum(r.amount for r in preview_rows if r.transaction_type == "income")
    total_expenses = sum(
        r.amount for r in preview_rows if r.transaction_type == "expense"
    )

    return ImportPreviewResponse(
        rows=preview_rows,
        total_income=total_income,
        total_expenses=total_expenses,
    )


@router.post("/confirm", response_model=ImportConfirmResponse)
def confirm_import(
    payload: ImportConfirmRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = db.get(Account, payload.account_id)
    if not account or account.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Conto non trovato")

    for row in payload.rows:
        amount = row.amount if row.transaction_type == "income" else -row.amount
        tx = Transaction(
            account_id=account.id,
            amount=amount,
            transaction_type=row.transaction_type,
            description=row.description,
            date=datetime.strptime(row.date, "%Y-%m-%d"),
        )
        db.add(tx)
        account.balance = float(account.balance) + amount

    db.commit()
    return ImportConfirmResponse(imported=len(payload.rows))
