-- GeoBuild AI — Database Initialization
-- Runs automatically on first container startup

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Plots table
CREATE TABLE IF NOT EXISTS plots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255),
    city VARCHAR(100) NOT NULL DEFAULT 'lahore',
    geometry GEOMETRY(Polygon, 4326) NOT NULL,
    area_sqm DOUBLE PRECISION,
    area_marla DOUBLE PRECISION,
    front_edge_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Design versions table
CREATE TABLE IF NOT EXISTS design_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plot_id UUID REFERENCES plots(id) ON DELETE CASCADE,
    version INTEGER NOT NULL DEFAULT 1,
    spec JSONB NOT NULL,
    prompt TEXT,
    assumptions TEXT[],
    glb_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analysis cache table
CREATE TABLE IF NOT EXISTS analysis_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    design_version_id UUID REFERENCES design_versions(id) ON DELETE CASCADE,
    coverage_pct DOUBLE PRECISION,
    far_ratio DOUBLE PRECISION,
    covered_area_sqm DOUBLE PRECISION,
    total_height_m DOUBLE PRECISION,
    parking_spaces INTEGER,
    estimated_cost_pkr BIGINT,
    compliance_issues JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- LLM response cache (hash-based dedup)
CREATE TABLE IF NOT EXISTS llm_cache (
    prompt_hash VARCHAR(64) PRIMARY KEY,
    model VARCHAR(100) NOT NULL,
    response JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Spatial index
CREATE INDEX IF NOT EXISTS idx_plots_geometry ON plots USING GIST (geometry);
CREATE INDEX IF NOT EXISTS idx_design_versions_plot ON design_versions (plot_id);
