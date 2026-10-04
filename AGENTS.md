# GeoBuild AI — Agent Instructions

## Project Overview
GeoBuild AI is an AI-powered geospatial platform for visualizing real-estate developments. 
It uses a pipeline: Natural Language → AI Building Specification → Procedural 3D Generation → Geospatial Placement.

## Architecture
- `apps/web` — Next.js + CesiumJS frontend (TypeScript)
- `apps/api` — NestJS backend API (TypeScript)
- `apps/ai-service` — FastAPI AI & geometry service (Python)
- `infra/` — Docker Compose for PostGIS
- `data/rules/` — Regulatory rules JSON files
- `data/styles/` — Facade/material style presets
- `data/samples/` — Sample GLB files for testing

## Critical Rules

### AI & LLM
1. The LLM **never** outputs geometry. It only produces `BuildingSpec` JSON.
2. One LLM call per user action. Never chain multiple calls for a single command.
3. Always re-validate LLM output with Pydantic, even when using structured output mode.
4. Cache LLM responses by hashing `(prompt + current_spec)` and storing in the `llm_cache` table.
5. Use Flash-class models only (e.g., `gemini-2.5-flash`). Pro models are not needed.
6. Never send private user data to the LLM. Plot coordinates and building descriptions are acceptable.

### Units & Coordinates
7. All internal measurements are in **metres**.
8. All geometry computation uses **UTM** projections:
   - Lahore & Islamabad: EPSG:32643
   - Karachi: EPSG:32642
9. Geographic coordinates (lat/lon) use **WGS84 (EPSG:4326)**.
10. 1 marla ≈ 25.2929 m² (≈ 272.25 sq ft). Verify during implementation.

### 3D Generation
11. Procedural geometry only — no AI-generated meshes.
12. All 3D output is GLB format.
13. Use `trimesh` for extrusion and `manifold3d` for CSG operations.
14. Facade styles come from `data/styles/*.json`, never hardcoded.

### Regulations
15. Never hardcode building regulations. Read from `data/rules/*.json`.
16. Always show "Preliminary check — not legal or regulatory approval" disclaimer.
17. The LLM must never produce cost estimates. Use rate tables from `data/rules/cost_rates_pk.json`.

### Code Quality
18. Write tests before geometry code.
19. Every API endpoint must have input validation (Zod on frontend, Pydantic on Python).
20. Use TypeScript strict mode in all TS projects.
21. Commit before starting each new feature.

## Tech Stack
- **Frontend:** Next.js 14+, TypeScript, CesiumJS, Turf.js, Zustand
- **Backend API:** NestJS, TypeScript, TypeORM/Prisma
- **AI Service:** FastAPI, Python, google-genai, Pydantic
- **3D Pipeline:** trimesh, manifold3d, pygltflib, shapely, pyproj
- **Database:** PostgreSQL 16 + PostGIS 3.4
- **3D Formats:** GLB, glTF, 3D Tiles
