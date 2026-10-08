from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

class Base(DeclarativeBase):
	pass

class User(Base):
	__tablename__ = "users"


	id: Mapped[int] = mapped_column(primary_key=True)
	email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
	password_hash: Mapped[str] = mapped_column(String, nullable=False)

	# track consecutive failed login attempts for account lockout
	failed_login_attempts: Mapped[int] = mapped_column(
		default=0,
		nullable=False
	)

	# store the time until which the account is locked
	locked_until: Mapped[datetime |None] = mapped_column(
		DateTime(timezone=True),
		nullable=True
	)

class FoodEntry(Base):
	__tablename__ = "food_entries"

	id: Mapped[int] = mapped_column(primary_key=True)
	
	user_id: Mapped[int] = mapped_column(nullable=False)

	food_name: Mapped[str] = mapped_column(String, nullable=False)

	calories: Mapped[float] = mapped_column(nullable=False)

	entry_date: Mapped[datetime] = mapped_column(
		DateTime(timezone=True),
		nullable=False
	)
