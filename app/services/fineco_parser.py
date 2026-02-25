"""
Parser for Fineco bank Excel exports.

Actual column names (row 13 in the file):
  Data_Operazione, Data_Valuta, Entrate, Uscite,
  Descrizione, Descrizione_Completa, Stato

- Dates are ISO datetime objects: 2026-02-25 00:00:00
- Uscite amounts already carry a minus sign: -5.95
- Entrate amounts are positive: 1234.56
- Thousands separator may use dot, decimal uses comma: 1.234,56
"""

from datetime import datetime
from decimal import Decimal, InvalidOperation

import openpyxl


_COL_DATE = "data_operazione"
_COL_INCOME = "entrate"
_COL_EXPENSE = "uscite"
_COL_DESC = "descrizione"
_COL_DESC_FULL = "descrizione_completa"


def _parse_amount(value) -> Decimal | None:
    """Parse amount (Italian or English format), strip sign, return absolute Decimal or None."""
    if value is None or str(value).strip() in ("", "-", "0", "0.0"):
        return None
    s = str(value).strip().lstrip("-")
    if "," in s:
        # Italian format: 1.234,56 — dot is thousands sep, comma is decimal sep
        s = s.replace(".", "").replace(",", ".")
    # else: English/standard format — dot is decimal sep, use as-is
    try:
        d = Decimal(s)
        return d if d > 0 else None
    except InvalidOperation:
        return None


def _parse_date(value) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    s = str(value).strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None


def parse_fineco_excel(file_bytes: bytes) -> list[dict]:
    """
    Parse a Fineco Excel export and return a list of dicts:
      {date, amount, transaction_type, description}
    """
    import io

    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
    ws = wb.active

    # Find the header row
    header_row_idx = None
    col_map: dict[str, int] = {}

    for i, row in enumerate(ws.iter_rows(values_only=True), start=1):
        headers = [str(c).strip().lower() if c is not None else "" for c in row]
        if _COL_DATE in headers:
            header_row_idx = i
            col_map = {h: idx for idx, h in enumerate(headers)}
            break

    if header_row_idx is None:
        raise ValueError(
            "Intestazione non trovata. "
            "Assicurati di esportare il file da Fineco: "
            "Conto > Movimenti > seleziona il periodo > Esporta."
        )

    transactions = []
    for row in ws.iter_rows(min_row=header_row_idx + 1, values_only=True):
        date = _parse_date(row[col_map[_COL_DATE]])
        if date is None:
            continue

        income = _parse_amount(row[col_map[_COL_INCOME]])
        expense = _parse_amount(row[col_map[_COL_EXPENSE]])

        if income is None and expense is None:
            continue

        desc_col = _COL_DESC_FULL if _COL_DESC_FULL in col_map else _COL_DESC
        description = str(row[col_map[desc_col]] or "").strip() or None

        if income is not None:
            transactions.append({
                "date": date,
                "amount": income,
                "transaction_type": "income",
                "description": description,
            })
        else:
            transactions.append({
                "date": date,
                "amount": expense,
                "transaction_type": "expense",
                "description": description,
            })

    return transactions
