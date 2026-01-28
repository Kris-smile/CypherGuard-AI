from fastapi import FastAPI
from fastapi.responses import PlainTextResponse
import os

app = FastAPI(title="Chat Service")

@app.get("/healthz", response_class=PlainTextResponse)
async def health_check():
    """Health check endpoint"""
    return "OK"

@app.get("/chat/healthz", response_class=PlainTextResponse)
async def chat_health_check():
    """Chat service health check"""
    return "Chat Service OK"

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
