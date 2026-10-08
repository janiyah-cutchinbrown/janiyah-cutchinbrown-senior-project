import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# load environment variables from the .env file
load_dotenv()

# get the PostgreSQL connection URL
DATABASE_URL = os.getenv("DATABASE_URL")

# create the SQLAlchemy engine used to connect to PostgreSQL
engine = create_engine(DATABASE_URL)

# create a factory for opening database sessions
SessionLocal = sessionmaker(bind=engine)

# provide a database session for FastAPI requests
def get_db():
	db = SessionLocal()
	try:
		yield db
	finally:
		db.close()
