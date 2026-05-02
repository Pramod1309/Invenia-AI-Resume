from fastapi import FastAPI
from fastapi.responses import JSONResponse

app = FastAPI()

@app.get("/health")
async def health_check():
    return JSONResponse(
        status="healthy",
        message="Invenia AI is running",
        version="1.0.0"
    )
