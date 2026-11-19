from datetime import datetime

from sqlalchemy import DateTime, String, Column, Integer, Float, ForeignKey
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

class Base(DeclarativeBase):
	pass

class User(Base):
	__tablename__ = "users"


	id: Mapped[int] = mapped_column(primary_key=True)
	email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
	password_hash: Mapped[str] = mapped_column(String, nullable=False)

	# store the user's daily calorie goal 
	daily_calorie_goal: Mapped[int] = mapped_column(
		default=2000,
		nullable=False
	)

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

class UserSession(Base):
	__tablename__ = "user_sessions"

	# unique identifier for each session
	id = Column(Integer, primary_key=True, index=True)

	# account associated with the session
	user_id = Column(
		Integer, 
		ForeignKey("users.id", ondelete="CASCADE"), 
		nullable=False
	)

	# SHA-256 hash of the session token 
	token_hash = Column(String(64), unique=True, nullable=False)

	# time when the session expires 
	expires_at = Column(DateTime(timezone=True),nullable=False)
