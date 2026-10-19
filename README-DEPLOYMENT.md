# 🚀 Railway Deployment Guide

## 📋 Prerequisites
- Railway CLI installed (`npm install -g @railway/cli`)
- Railway account created
- Git repository initialized

## 🔧 Configuration Files Created

### 1. `railway.toml`
- Main Railway configuration file
- Configures build, deploy, and environment settings
- Sets up both backend and frontend services

### 2. `.env.production`
- Production environment variables template
- Database URL, JWT secrets, OAuth configurations
- CORS settings for production

### 3. `backend/Dockerfile`
- Optimized for Railway deployment
- Multi-stage build with Python 3.11-slim
- Exposes port 8000
- Uses Uvicorn for production

### 4. `frontend/Dockerfile`
- Multi-stage build with Node.js
- Nginx for serving static files
- Proxy configuration for API calls

### 5. `backend/health.py`
- Health check endpoint for Railway monitoring
- Returns application status and version

### 6. `frontend/nginx.conf`
- Nginx configuration for production
- API proxy to backend service
- Static file serving

## 🚀 Deployment Steps

### Option 1: Using Railway CLI
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway up
```

### Option 2: Manual Deployment
1. Push code to GitHub repository
2. Connect Railway to GitHub account
3. Deploy from Railway dashboard
4. Configure environment variables in Railway dashboard

## 🌐 Environment Variables Required

### Backend
- `DATABASE_URL`: PostgreSQL connection string
- `SECRET_KEY`: JWT secret key
- `GOOGLE_CLIENT_ID`: Google OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret
- `GITHUB_CLIENT_ID`: GitHub OAuth client ID
- `GITHUB_CLIENT_SECRET`: GitHub OAuth client secret
- `LINKEDIN_CLIENT_ID`: LinkedIn OAuth client ID
- `LINKEDIN_CLIENT_SECRET`: LinkedIn OAuth client secret

### Frontend
- `VITE_API_URL`: Backend API URL for frontend

## 🔍 Health Check
Once deployed, your app will be available at:
- Health endpoint: `https://your-app-url.railway.app/health`
- Main application: `https://your-app-url.railway.app`

## 📱 Application Structure
```
invenia-ai/
├── railway.toml          # Railway configuration
├── .env.production         # Environment variables
├── backend/
│   ├── Dockerfile         # Backend container
│   ├── health.py         # Health check
│   └── main.py           # FastAPI application
└── frontend/
    ├── Dockerfile         # Frontend container
    ├── nginx.conf         # Nginx configuration
    └── dist/             # Built React application
```

## ✅ Deployment Ready
Your Invenia AI application is now fully configured and ready for Railway deployment!

## Frontend Hosting (Railway + Existing Backend)

Use this when backend is already live on Railway and you want to host only the frontend.

1. Login in your local terminal:
```bash
railway login
```
2. Link this repo to your Railway project:
```bash
railway link
```
3. Create a frontend service (first time only):
```bash
railway add --service invenia-frontend
```
4. Set backend URL for Nginx proxy in that service:
```bash
railway variable set BACKEND_UPSTREAM=<your-backend-service-url> --service invenia-frontend
```
5. Deploy only the `frontend` folder:
```bash
railway up ./frontend --path-as-root --service invenia-frontend
```
6. Generate a public domain:
```bash
railway domain --service invenia-frontend
```

Notes:
- The frontend Docker image now serves React via Nginx and proxies `/api` and `/uploads` to `BACKEND_UPSTREAM`.
- Backend CORS now supports `ALLOWED_ORIGINS`, `CORS_ORIGINS`, and a Railway domain regex by default.

## Current Railway Split Setup

Use two separate Railway services:

1. Backend service
   - Root: repository root
   - Dockerfile: `backend/Dockerfile`
   - Public URL: Railway-generated backend domain
   - Important env vars:
     - `DATABASE_URL` or `RAILWAY_DATABASE_URL`
     - `SECRET_KEY`
     - `GEMINI_API_KEY`
     - `GEMINI_MODEL`
     - `ELEVENLABS_API_KEY`
     - `ELEVENLABS_VOICE_ID`
     - `ELEVENLABS_MODEL_ID`
     - `CORS_ORIGINS` with the frontend URL if you call the API directly

2. Frontend service
   - Root: `frontend`
   - Dockerfile: `frontend/Dockerfile`
   - Public URL: Railway-generated frontend domain
   - Important env vars:
     - `BACKEND_UPSTREAM` set to the backend service public URL

The frontend app uses same-origin `/api` requests in production, while Nginx proxies those requests to `BACKEND_UPSTREAM`. That keeps the browser app fast and avoids extra CORS traffic for normal hosted use.
