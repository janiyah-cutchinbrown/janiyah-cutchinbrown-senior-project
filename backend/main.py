from datetime import datetime, timedelta, timezone

from fastapi import Depends, FastAPI, HTTPException, Response, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware

from database import get_db
from models import User, FoodEntry, UserSession
from security import hash_password, verify_password

import secrets
import hashlib

# create the FastAPI application
app = FastAPI()

# allow the Next.js frontend to communicate with the backend 
app.add_middleware(
	CORSMiddleware,
	allow_origins=["http://localhost:3000"],
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)

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
	user_id: int # identify which account owns the entry
	food_name: str
	calories: float
	entry_date: datetime 

# define the information needed to edit an existing food entry
class FoodEntryUpdate(BaseModel):
	user_id: int
	food_name: str
	calories: float
	entry_date: datetime

#define the data required to set a daily calorie goal 
class CalorieGoalUpdate(BaseModel):
	user_id: int
	daily_calorie_goal: int

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
def login(user: LoginRequest, response: Response,db: Session = Depends(get_db)):
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
	
	# generate a secure random session token 
	session_token = secrets.token_urlsafe(32)

	# store only the SHA-256 hash of the token in PostgreSQL
	hashed_token = hashlib.sha256(
		session_token.encode()
	).hexdigest()

	# set the initial session expiration to five minutes 
	expiration = datetime.now(timezone.utc) + timedelta(minutes=5)

	# create a new session record 
	new_session = UserSession(
		user_id=existing_user.id,
		token_hash=hashed_token,
		expires_at=expiration
	)
	
	db.add(new_session)
	db.commit()

	# send the session token to the browser in the HttpOnly cookie
	response.set_cookie(
		key="session_token",
		value=session_token,
		httponly=True,
		secure=False, # local HTTP development only; True for HTTPS
		samesite="lax",
		path="/"
	)

	# login successful
	return {
		"message": "Login successful",
		"user_id": existing_user.id
	}

# check whether the user has a valid login session
@app.get("/session")
def check_session(request: Request, db: Session = Depends(get_db)):

	# retrieve the session token from the browser's cookies
	session_token = request.cookies.get("session_token")

	# reject the requests wihout a session cookie
	if not session_token:
		raise HTTPException(
			status_code=401,
			detail="Not authenticated"
		)

	# hash the token to compare it with the database
	hashed_token = hashlib.sha256(
		session_token.encode()
	).hexdigest()

	# find the matching session
	result = db.execute(
		select(UserSession).where(
			UserSession.token_hash == hashed_token
		)
	)

	existing_session = result.scalar_one_or_none()

	# reject invalid or expired sessions
	if (
		existing_session is None 
		or datetime.now(timezone.utc) >= existing_session.expires_at
	):
		raise HTTPException(
			status_code=401,
			detail="Session expired or invalid"
		)

	# extend the session expiration after authenticated activity
	existing_session.expires_at = (
		datetime.now(timezone.utc) + timedelta(minutes=5)
	)

	# save the updated expiration time
	db.commit()

	
	# return the authenticated user's ID
	return {
		"message": "Session valid",
		"user_id": existing_session.user_id
	}

# log out and invalidate the user's session
@app.post("/logout")
def logout(
	request: Request,
	response: Response,
	db: Session = Depends(get_db)
):

	# retrieve the session token from the cookie
	session_token = request.cookies.get("session_token")

	if session_token:
		# hash the token to find the saved session
		hashed_token = hashlib.sha256(
			session_token.encode()
		).hexdigest()

		# search for the session in PostgreSQL
		result = db.execute(
			select(UserSession).where(
				UserSession.token_hash == hashed_token
			)
		)

		existing_session = result.scalar_one_or_none()

		# delete the session so it cannot be reused
		if existing_session:
			db.delete(existing_session)
			db.commit()

	# remove the browser's session cookie 
	response.delete_cookie(
		key="session_token",
		path="/"
	)

	return {"message": "Logged out successfully"}

# record a food entry for the user 
def get_current_user_id(
	request: Request,
	db:Session = Depends(get_db)
):
	# read the session token from the browser's cookies
	session_token = request.cookies.get("session_token")

	# reject requests without a session token
	if not session_token:
		raise HTTPException(
			status_code=401,
			detail="Not authenticated"
		)

	# hash the token to compare it with the database
	hashed_token = hashlib.sha256(
		session_token.encode()
	).hexdigest()

	# find the matching session in PostgreSQL
	existing_session = db.scalar(
		select(UserSession).where(
			UserSession.token_hash == hashed_token
		)
	)

	# reject invalid or expired session 
	if (
		existing_session is None 
		or datetime.now(timezone.utc) >= existing_session.expires_at
	):
		raise HTTPException(
			status_code=401,
			detail="Session expired or invalid"
		)
	# return the authenticated user's ID
	return existing_session.user_id

@app.post("/food-entries")
def create_food_entry(
	entry: FoodEntryCreate,
	db: Session = Depends(get_db),
	current_user_id: int = Depends(get_current_user_id)
):

	# prevent creating entries for another account 
	if entry.user_id != current_user_id:
		raise HTTPException(
			status_code=403,
			detail="Access denied"
		)
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
	# use the current date and time if no date was provided
	entry_date = entry.entry_date or datetime.now(timezone.utc)

	# create the food entry
	new_entry = FoodEntry(
		user_id=entry.user_id,
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
# retrieve the saved food entries for the user 
@app.get("/food-entries")
def get_food_entries(
	user_id: int, 
	db: Session = Depends(get_db),
	current_user_id: int = Depends(get_current_user_id)
	):

	# prevent retrieving entries for another account
	if user_id != current_user_id:
		raise HTTPException(
			status_code=403,
			detail="Access denied"
		)
	
	# retrieve food entries from the database, newest first
	entries = db.scalars(
		select(FoodEntry)
		.where(FoodEntry.user_id == user_id)
		.order_by(FoodEntry.entry_date.desc())
	).all()
	
	# return the saved entries as a list of dictionaries 
	return [
		{
			"id": entry.id,
			"food_name": entry.food_name,
			"calories": entry.calories,
			"entry_date": entry.entry_date.isoformat()
		}
		for entry in entries
	]
# retrieve the user's daily calorie goal 
@app.get("/calorie-goal")
def get_calorie_goal(
	user_id: int, 
	db: Session = Depends(get_db),
	current_user_id: int = Depends(get_current_user_id)
):

	# prevent users from viewing another account's calorie goal
	if user_id != current_user_id:
		raise HTTPException(
			status_code=403,
			detail="Access denied"
		)
	
	# find the account in the datatbase
	user = db.get(User, user_id)

	# return an error if the account does not exist 
	if user is None: 
		raise HTTPException(
			status_code=404,
			detail="User not found"
		)

	# return the save calorie goal 
	return {
		"user_id": user.id,
		"daily_calorie_goal": user.daily_calorie_goal
	}
# update a user's daily calorie goal 
@app.put("/calorie-goal")
def update_calorie_goal(
	goal: CalorieGoalUpdate,
	db: Session = Depends(get_db),
	current_user_id: int = Depends(get_current_user_id)
):

	# prevent users from updating another account's calorie goal
	if goal.user_id != current_user_id:
		raise HTTPException(
			status_code=403,
			detail="Access denied"
		)
	
	# reject zero or negative goals 
	if goal.daily_calorie_goal <= 0: 
		raise HTTPException(
			status_code=400,
			detail="Daily calorie goal must be greater than 0"
		)
	# find the account in the database 
	user = db.get(User, goal.user_id)

	# return an error if the account does not exist
	if user is None: 
		raise HTTPException(
			status_code=404,
			detail="User not found"
		)

	# save the updated goal 
	user.daily_calorie_goal = goal.daily_calorie_goal
	db.commit()
	db.refresh(user)

	return {
		"message": "Daily calorie goal updated successfully",
		"user_id": user.id,
		"daily_calorie_goal": user.daily_calorie_goal
	}

# update an existing food entry
@app.put("/food-entries/{entry_id}")
def update_food_entry(
	entry_id: int,
	entry: FoodEntryUpdate,
	db: Session = Depends(get_db),
	current_user_id: int = Depends(get_current_user_id)
):

	# prevent users from updating another account's food entry
	if entry.user_id != current_user_id:
		raise HTTPException(
			status_code=403,
			detail="Access denied"
		)
	
	# find the food entry using its unique ID
	saved_entry = db.get(FoodEntry, entry_id)

	# make sure the entry exists and belongs to this user 
	if saved_entry is None or saved_entry.user_id != entry.user_id:
		raise HTTPException(
			status_code=404,
			detail="Food entry not found"
		)

	# prevent blank food names 
	if not entry.food_name.strip():
		raise HTTPException(
			status_code=400,
			detail="Food name cannot be blank"
		)

	# prevent invalid calorie amounts 
	if entry.calories <= 0:
		raise HTTPException(
			status_code=400,
			detail="Calories must be greater than 0"
		)
	
	# update the existing entry 
	saved_entry.food_name = entry.food_name
	saved_entry.calories = entry.calories
	saved_entry.entry_date = entry.entry_date

	# save the changes to PostgreSQL
	db.commit()
	db.refresh(saved_entry)

	return {
		"message": "Food entry updated successfully",
		"id": saved_entry.id,
		"food_name": saved_entry.food_name,
		"calories": saved_entry.calories,
		"entry_date": saved_entry.entry_date.isoformat()
	}

# delete an existing food entry 
@app.delete("/food-entries/{entry_id}")
def delete_food_entry(
	entry_id: int,
	user_id: int,
	db: Session = Depends(get_db),
	current_user_id: int = Depends(get_current_user_id)
):

	# prevent users from deleting another account's food entry
	if user_id != current_user_id:
		raise HTTPException(
			status_code=403,
			detail="Access denied"
		)
	
	# find the food entry by its ID 
	saved_entry = db.get(FoodEntry, entry_id)

	# make sure the entry exists and belongs to this user 
	if saved_entry is None or saved_entry.user_id != user_id:
		raise HTTPException(
			status_code=404,
			detail="Food entry not found"
		)