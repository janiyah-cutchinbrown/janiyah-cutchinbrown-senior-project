from datetime import datetime, timedelta, timezone

from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import get_db
from models import User, FoodEntry
from security import hash_password, verify_password

# create the FastAPI application
app = FastAPI()

# define the data required when creating a user account
class UserCreate(BaseModel):
	email: str
	password: str

# define the data required when logging into account
class LoginRequest(BaseModel):
	email: str
	password: str

# define the data required when recording a food entry
class FoodEntryCreate(BaseModel):
	food_name: str
	calories: float
	entry_date: datetime | None = None

# test endpoint to verify that the API is running
@app.get("/")
def root():
	return {"message": "Calorie Tracker API is running"}

# account registration endpoint
@app.post("/register")
def register(user: UserCreate, db: Session = Depends(get_db)):
	# reject registration if any fields are blank
	if not user.email.strip() or not user.password.strip():
		raise HTTPException(
			status_code=400,
			detail="Email and password cannot be blank"
		)

	# check whether an account with this email already exists
	result = db.execute(
		select(User).where(User.email == user.email)
	)
	existing_user = result.scalar_one_or_none()

	# reject registration if the email is already in use
	if existing_user:
		raise HTTPException(
			status_code=400,
			detail="Email already registered"
		)

	# hash the password before storing it
	hashed_password = hash_password(user.password)

	# create a new user with the submitted email and hashed password
	new_user = User(
		email=user.email,
		password_hash=hashed_password
	)

	# hash the password before storing it
	hashed_password = hash_password(user.password)

	# create a new user with the submitted email and hashed password
	new_user = User(
		email=user.email,
		password_hash=hashed_password
	)

	# add the new user to the database session
	db.add(new_user)

	# save the new user to PostgreSQL
	db.commit()

	# get the generated database ID for the new user
	db.refresh(new_user)

	return {
		"message": "Account created successfully",
		"user_id": new_user.id
	}

# login endpoint
@app.post("/login")
def login(user: LoginRequest, db: Session = Depends(get_db)):
	# find the account that matched with the submitted email
	result = db.execute(
		select(User).where(User.email == user.email)
	)
	existing_user = result.scalar_one_or_none()

	# reject the login if the email is not registered
	if not existing_user:
		raise HTTPException(
			status_code=401,
			detail="Invalid email or passowrd"
		)

	# check whether the account is currently locked
	if existing_user.locked_until is not None:
		if datetime.now(timezone.utc) < existing_user.locked_until:
			raise HTTPException(
				status_code=403,
				detail="Account is temporarily locked. Try again later."
			)
		# the lockout has expired, so reset failed-attempt counter
		existing_user.failed_login_attempts = 0
		existing_user.locked_until = None

	# check whether the submitted password matches the stored password hash
	if not verify_password(user.password, existing_user.password_hash):
		# increase the failed login attempt counter
		existing_user.failed_login_attempts += 1

		# lock the account after five failed attempts
		if existing_user.failed_login_attempts >= 5:
			existing_user.locked_until = (
				datetime.now(timezone.utc) + timedelta(minutes=5)
		)
			db.commit()

			raise HTTPException(
				status_code=403,
				detail="Account is temporarily locked. Try again in 5 minutes."
			)
		# save updated failed attempt count
		db.commit()


		raise HTTPException(
			status_code=401,
			detail="Invalid email or password"
		)
	# successful login resets the failed-attempt counter
	existing_user.failed_login_attempts = 0
	existing_user.locked_until = None
	db.commit()
	
	# login successful
	return {
		"message": "Login successful",
		"user_id": existing_user.id
	}

# record a food entry for the user 
@app.post("/food-entries")
def create_food_entry(
	entry: FoodEntryCreate,
	db: Session = Depends(get_db)
):
	# reject a blank food name 
	if not entry.food_name.strip():
		raise HTTPException(
			status_code=400,
			detail="Food name cannot be blank"
		)
	# reject zero or negative calorie amounts
	if entry.calories <= 0:
		raise HTTPException(
			status_code=400,
			detail="Calories must be greater than 0"
		)
	# use the cirrent date and time if no date was provided
	entry_date = entry.entry_date or datetime.now(timezone.utc)

	# create the food entry
	new_entry = FoodEntry(
		user_id=1,
		food_name=entry.food_name,
		calories=entry.calories,
		entry_date=entry_date
	)

	# add the entry to the database
	db.add(new_entry)
	db.commit()

	# get the generated entry id
	db.refresh(new_entry)

	return {
		"message": "Food entry created successfully!",
		"entry_id": new_entry.id
	}
