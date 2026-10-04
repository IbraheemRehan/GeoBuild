# GeoBuild AI — Product Requirements Document

## Vision
An AI-powered geospatial platform that enables property developers, architects, and real-estate professionals in Pakistan to visualize and evaluate potential developments using natural language and interactive 3D maps.

## Core Pipeline
```
Natural Language → AI Building Spec → Spatial Constraints → Procedural 3D → Geospatial Placement → Interactive Modification → Feasibility Analysis
```

## Target Users
- Property developers evaluating sites
- Architects in early-stage concept design
- Real-estate professionals presenting development potential

## Target Cities (Phase 1)
- Lahore (primary)
- Islamabad
- Karachi

## Key Features

### 1. Interactive Map & Plot Selection
- CesiumJS 3D globe with terrain and OSM buildings
- Polygon draw tool for custom plots
- Plot entry by dimensions (marla, kanal, sq ft)
- Road/front edge marking

### 2. Natural Language Building Design
- Describe buildings in English or Roman Urdu
- AI converts to structured BuildingSpec
- Sensible Pakistani residential defaults
- Few-shot examples for accuracy

### 3. Interactive AI Chat
- Modify buildings via commands: "add a floor", "make it more modern"
- Patch system preserves unchanged fields
- Version history with undo/redo
- Fallback regex parser for LLM failures

### 4. Procedural 3D Generation
- Floor extrusion from plot footprint
- Window/door placement
- Facade style presets (Contemporary Pakistani, Modern Minimal, Classical, Mughal-Inspired)
- GLB output placed on real terrain

### 5. Development Analysis
- Plot dimensions and area
- Building coverage and FAR
- Height and floor count
- Parking requirements
- Construction cost estimate (PKR)
- Compliance checking against city regulations

## Technical Stack
| Component | Technology |
|-----------|-----------|
| Frontend | Next.js, TypeScript, CesiumJS, Turf.js, Zustand |
| Backend API | NestJS, TypeScript, TypeORM |
| AI Service | FastAPI, Python, google-genai, Pydantic |
| 3D Pipeline | trimesh, manifold3d, pygltflib, shapely |
| Database | PostgreSQL 16 + PostGIS 3.4 |
| 3D Formats | GLB, glTF |

## Constraints
- Gemini free tier: max 5-10 RPM on Flash models
- One LLM call per user action
- Cache all LLM responses
- LLM never produces geometry or cost figures
- All regulations from JSON files, not hardcoded
