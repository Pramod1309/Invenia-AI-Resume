# Invenia AI - AI-Powered Recruitment Platform

A modern web application for recruiters and candidates, similar to Mercor AI, featuring AI-powered job matching, resume screening, and recruitment management.

## Features

- **Dual Role System**: Separate interfaces for recruiters and candidates
- **Responsive Design**: Optimized for desktop, laptop, tablet, and mobile
- **Animated Splash Screen**: Beautiful Invenia AI branding with dark navy blue theme
- **OAuth Authentication**: Support for Google, GitHub, and LinkedIn login
- **JWT Security**: Secure token-based authentication
- **Modern UI**: Built with React, Vite, and TailwindCSS
- **FastAPI Backend**: High-performance Python API with PostgreSQL

## Tech Stack

### Frontend
- **React 18** with Vite
- **TailwindCSS** for styling
- **React Router** for navigation
- **Heroicons** for icons
- **Axios** for API calls

### Backend
- **FastAPI** Python framework
- **PostgreSQL** database
- **SQLAlchemy** ORM
- **JWT** authentication
- **OAuth2** integration (Google, GitHub, LinkedIn)

## Project Structure

```
Invenia AI/
frontend/
  src/
    components/
      - SplashScreen.jsx
    pages/
      - LoginSelector.jsx
      - CandidateLogin.jsx
      - RecruiterLogin.jsx
    App.jsx
    index.css
  package.json
  tailwind.config.js
backend/
  main.py
  database.py
  models.py
  schemas.py
  auth.py
  routers/
    - auth.py
    - users.py
    - candidates.py
    - recruiters.py
  requirements.txt
  .env.example
```

## Setup Instructions

### Prerequisites
- Node.js 18+ and npm
- Python 3.9+
- PostgreSQL
- Git

### 1. Clone the Repository
```bash
git clone <repository-url>
cd "Invenia AI"
```

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`

### 3. Backend Setup

```bash
cd backend
pip install -r requirements.txt
```

### 4. Database Setup

1. Install PostgreSQL and create a database:
```sql
CREATE DATABASE invenia_ai;
```

2. Copy environment file:
```bash
cp .env.example .env
```

3. Update `.env` with your configuration:
```env
DATABASE_URL=postgresql://username:password@localhost/invenia_ai
SECRET_KEY=your-super-secret-key
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

### 5. Run the Backend

```bash
uvicorn main:app --reload
```

The API will be available at `http://localhost:8000`

### 6. Access the Application

- **Frontend**: `http://localhost:5173`
- **API Documentation**: `http://localhost:8000/docs`

## Application Flow

1. **Splash Screen**: Animated Invenia AI branding (3 seconds)
2. **Login Selection**: Choose between Candidate or Recruiter login
3. **Separate Login Pages**: 
   - Candidate Login (Blue theme)
   - Recruiter Login (Purple theme)
4. **OAuth Options**: Google, GitHub, LinkedIn authentication
5. **Role-based Dashboards**: Separate interfaces for each user type

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/oauth/google` - Google OAuth
- `POST /api/auth/oauth/github` - GitHub OAuth

### Users
- `GET /api/users/me` - Get user info
- `PUT /api/users/me` - Update user
- `GET /api/users/me/profile` - Get user profile

### Candidates
- `POST /api/candidates/profile` - Create candidate profile
- `GET /api/candidates/profile` - Get candidate profile
- `PUT /api/candidates/profile` - Update candidate profile

### Recruiters
- `POST /api/recruiters/profile` - Create recruiter profile
- `GET /api/recruiters/profile` - Get recruiter profile
- `PUT /api/recruiters/profile` - Update recruiter profile

## Development

### Frontend Development
```bash
cd frontend
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
```

### Backend Development
```bash
cd backend
uvicorn main:app --reload  # Development server
uvicorn main:app --host 0.0.0.0 --port 8000  # Production
```

## Design System

### Colors
- **Navy Blue**: `#0f172a` (Primary background)
- **Invenia Blue**: `#1e3a8a` (Secondary background)
- **Blue**: `#2563eb` (Candidate theme)
- **Purple**: `#9333ea` (Recruiter theme)

### Components
- **Buttons**: Primary, Secondary styles with hover effects
- **Inputs**: Consistent form styling with focus states
- **Cards**: Glassmorphism effects for modern look

## Security Features

- JWT token-based authentication
- Password hashing with bcrypt
- OAuth2 integration
- CORS protection
- Input validation with Pydantic

## Next Steps

1. Implement dashboard pages for candidates and recruiters
2. Add job posting and application features
3. Integrate AI-powered resume screening
4. Add real-time notifications
5. Implement chat/messaging system
6. Add file upload for resumes
7. Create admin panel for platform management

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.


## API Keys

### Google API Key
Set `GOOGLE_API_KEY` in `backend/.env`. Never commit the real key.


### NVIDIA API Key
Set `NVIDIA_API_KEY` in `backend/.env`. Never commit the real key.


### Groq API Key
Set `GROQ_API_KEY` in `backend/.env`. Never commit the real key.
