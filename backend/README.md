# Invenia AI Backend

FastAPI backend for the Invenia AI recruitment platform.

## Setup Instructions

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Database Setup

Install PostgreSQL and create a database:

```sql
CREATE DATABASE invenia_ai;
```

### 3. Environment Configuration

Copy `.env.example` to `.env` and update the values:

```bash
cp .env.example .env
```

Update the following variables:
- `DATABASE_URL`: PostgreSQL connection string
- `SECRET_KEY`: Generate a secure secret key
- OAuth client IDs and secrets (optional)

### 4. Run the Application

```bash
uvicorn main:app --reload
```

The API will be available at `http://localhost:8000`

### 5. API Documentation

Visit `http://localhost:8000/docs` for interactive API documentation.

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/oauth/google` - Google OAuth login
- `POST /api/auth/oauth/github` - GitHub OAuth login

### Users
- `GET /api/users/me` - Get current user info
- `PUT /api/users/me` - Update current user
- `GET /api/users/me/profile` - Get user profile

### Candidates
- `POST /api/candidates/profile` - Create candidate profile
- `GET /api/candidates/profile` - Get candidate profile
- `PUT /api/candidates/profile` - Update candidate profile

### Recruiters
- `POST /api/recruiters/profile` - Create recruiter profile
- `GET /api/recruiters/profile` - Get recruiter profile
- `PUT /api/recruiters/profile` - Update recruiter profile
