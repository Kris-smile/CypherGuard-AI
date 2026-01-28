from fastapi import FastAPI
from fastapi.responses import PlainTextResponse
import os

app = FastAPI(title="Model Gateway")

@app.get("/healthz", response_class=PlainTextResponse)
async def health_check():
    """Health check endpoint"""
    return "OK"

@app.get("/internal/healthz", response_class=PlainTextResponse)
async def internal_health_check():
    """Model gateway health check"""
    return "Model Gateway OK"

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
