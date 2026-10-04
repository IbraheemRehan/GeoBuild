# GeoBuild AI

**AI-Powered 3D Real Estate & Development Platform**

An AI-powered geospatial platform for visualizing and evaluating potential property developments in real-world Pakistani locations. Select a plot, describe your building in natural language, and see it rendered in 3D on an interactive map.

## Pipeline

```
Natural Language → AI Building Spec → Spatial Constraints → Procedural 3D → Geospatial Placement → Interactive Editing → Feasibility Analysis
```

## Quick Start

```bash
# 1. Copy environment variables
cp .env.example .env
# Fill in GEMINI_API_KEY and NEXT_PUBLIC_CESIUM_ION_TOKEN

# 2. Start PostGIS
pnpm db:up

# 3. Install dependencies
pnpm install

# 4. Set up Python AI service
cd apps/ai-service
python -m venv .venv
.venv\Scripts\activate  # Windows
pip install -r requirements.txt

# 5. Run all services
pnpm dev
```

## Architecture

| Service | Tech | Port |
|---------|------|------|
| Web Frontend | Next.js + CesiumJS | 3000 |
| Backend API | NestJS | 3001 |
| AI Service | FastAPI | 8000 |
| Database | PostgreSQL + PostGIS | 5432 |

## Project Structure

```
geobuild-ai/
├── apps/
│   ├── web/           # Next.js + CesiumJS frontend
│   ├── api/           # NestJS backend
│   └── ai-service/    # FastAPI AI & geometry service
├── data/
│   ├── rules/         # Building regulations & cost rates
│   ├── styles/        # Facade presets
│   └── samples/       # Sample GLB files
├── infra/             # Docker Compose & DB init
├── docs/              # Documentation
└── AGENTS.md          # AI agent instructions
```

## License

MIT
