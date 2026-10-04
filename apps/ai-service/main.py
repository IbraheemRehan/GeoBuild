"""
GeoBuild AI — AI & Geometry Service
FastAPI application for building spec generation and 3D model processing.
"""

import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import interpret, patch, generate, analyze

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup/shutdown lifecycle."""
    print("🚀 GeoBuild AI Service starting...")
    print(f"   Gemini API Key: {'✅ configured' if os.getenv('GEMINI_API_KEY') else '❌ missing'}")
    yield
    print("🛑 GeoBuild AI Service shutting down...")


app = FastAPI(
    title="GeoBuild AI Service",
    description="AI-powered building specification and 3D geometry generation",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(interpret.router, prefix="/api/v1", tags=["interpret"])
app.include_router(patch.router, prefix="/api/v1", tags=["patch"])
app.include_router(generate.router, prefix="/api/v1", tags=["generate"])
app.include_router(analyze.router, prefix="/api/v1", tags=["analyze"])


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "geobuild-ai",
        "gemini_configured": bool(os.getenv("GEMINI_API_KEY")),
    }
