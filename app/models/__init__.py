# Import all models here so Base.metadata is fully populated
# whenever anyone calls Base.metadata.create_all()
from app.models.account import Account  # noqa: F401
from app.models.budget import Budget  # noqa: F401
from app.models.transaction import Category, Transaction  # noqa: F401
from app.models.user import User  # noqa: F401
