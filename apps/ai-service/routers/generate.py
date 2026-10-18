"""
GeoBuild AI — Generate Router
Generates procedural 3D GLB models from BuildingSpec + plot geometry.
Rule 11: Procedural geometry only — no AI-generated meshes.
Rule 12: All 3D output is GLB format.
Rule 13: Use trimesh for extrusion.
Rule 14: Facade styles come from data/styles/*.json, never hardcoded.
Rule 15: Read building regulations from data/rules/*.json.
Rule 16: Always show disclaimer.
Rule 7: Measurements in metres.
Rule 8: UTM projections (EPSG:32643 / EPSG:32642).
Rule 9: Coordinates in WGS84.
"""

import base64
import json
import math
import os
from typing import Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from models import BuildingSpec
from geometry.projection import polygon_wgs84_to_utm, utm_to_wgs84
from geometry.footprint import compute_polygon_area_marla, compute_buildable_footprint
from geometry.generator import generate_building_glb

router = APIRouter()

REGULATIONS_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "data", "rules")
)


def _load_city_regulations(city: str) -> dict[str, Any] | None:
    """Load regulations from data/rules/{city}_regulations.json (Rule 15)."""
    reg_file = os.path.join(REGULATIONS_DIR, f"{city.lower()}_regulations.json")
    if os.path.exists(reg_file):
        try:
            with open(reg_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return None
    return None


def _get_setbacks_for_plot(city: str, area_marla: float) -> dict[str, float]:
    """Get setback values in metres from regulation rules based on plot size in marla."""
    regs = _load_city_regulations(city)
    if regs and "zones" in regs:
        zones = regs["zones"]
        matched_zone = None
        closest_diff = float("inf")
        for zone_id, zone_data in zones.items():
            zone_marla = zone_data.get("plot_size_marla", 0)
            diff = abs(area_marla - zone_marla)
            if diff < closest_diff:
                closest_diff = diff
                matched_zone = zone_data

        if matched_zone and "setbacks_m" in matched_zone:
            sb = matched_zone["setbacks_m"]
            return {
                "front": float(sb.get("front", 1.5)),
                "back": float(sb.get("back", 1.5)),
                "left": float(sb.get("left", 0.0)),
                "right": float(sb.get("right", 0.0)),
            }

    # Standard Pakistani residential setbacks (Rule 15)
    if area_marla <= 7.0:
        return {"front": 1.5, "back": 1.2, "left": 0.0, "right": 0.0}
    elif area_marla <= 14.0:
        return {"front": 3.0, "back": 2.0, "left": 0.5, "right": 0.5}
    elif area_marla <= 25.0:
        return {"front": 4.5, "back": 3.0, "left": 1.5, "right": 1.5}
    else:
        return {"front": 6.0, "back": 4.5, "left": 2.0, "right": 2.0}


class GenerateRequest(BaseModel):
    """Request to generate a 3D model from a BuildingSpec."""
    spec: BuildingSpec
    plot_polygon_wgs84: list[list[float]] = Field(
        ..., description="Plot boundary as [[lng, lat], ...] in WGS84"
    )
    front_edge_index: int = Field(0, ge=0, description="Index of the front (road) edge")
    city: str = Field("lahore", pattern=r"^(lahore|islamabad|karachi)$")


class GenerateResponse(BaseModel):
    """Response from the generate endpoint."""
    glb_url: str | None = None
    glb_base64: str | None = None
    glb_data_uri: str | None = None
    building_footprint_sqm: float = 0
    plot_area_sqm: float = 0
    plot_area_marla: float = 0
    total_height_m: float = 0
    center_wgs84: list[float] = [0.0, 0.0]
    heading_deg: float = 0.0
    status: str = "success"
    message: str = ""
    disclaimer: str = "Preliminary check — not legal or regulatory approval"
    metadata: dict[str, Any] = {}


@router.post("/generate", response_model=GenerateResponse)
async def generate_model(request: GenerateRequest):
    """
    Generate a 3D GLB model from a BuildingSpec and plot geometry.
    """
    try:
        plot_coords = request.plot_polygon_wgs84
        if len(plot_coords) < 3:
            raise HTTPException(status_code=400, detail="Plot polygon must have at least 3 coordinates")

        # 1. Convert WGS84 plot boundary to UTM (Rule 8 & 9)
        plot_utm = polygon_wgs84_to_utm(plot_coords, city=request.city)

        # 2. Compute plot area in marla and sqm (Rule 7 & 10)
        area_marla, area_sqm = compute_polygon_area_marla(plot_utm)

        # 3. Retrieve regulatory setbacks (Rule 15)
        setbacks = _get_setbacks_for_plot(request.city, area_marla)

        # 4. Compute buildable footprint polygon with setbacks in canonical frame
        footprint_poly, footprint_sqm, frame = compute_buildable_footprint(
            plot_utm=plot_utm,
            front_edge_idx=request.front_edge_index,
            setbacks=setbacks,
        )

        # 5. Generate realistic procedural 3D GLB building (Rule 11, 12, 13, 14)
        glb_bytes, meta = generate_building_glb(
            footprint_poly=footprint_poly,
            spec=request.spec,
            plot_poly=frame["poly_canonical"],
        )

        # 6. Calculate centroid in WGS84 for Cesium placement
        c_utm_x, c_utm_y = frame["centroid"]
        center_lon, center_lat = utm_to_wgs84(c_utm_x, c_utm_y, city=request.city)

        # 7. Cesium heading angle in degrees
        heading_deg = float(frame["cesium_heading_deg"])

        # 8. Encode to base64 and data URI for immediate browser rendering
        glb_b64 = base64.b64encode(glb_bytes).decode("ascii")
        glb_data_uri = f"data:model/gltf-binary;base64,{glb_b64}"

        return GenerateResponse(
            glb_url=None,
            glb_base64=glb_b64,
            glb_data_uri=glb_data_uri,
            building_footprint_sqm=round(footprint_sqm, 1),
            plot_area_sqm=round(area_sqm, 1),
            plot_area_marla=round(area_marla, 1),
            total_height_m=round(float(meta.get("total_height_m", 7.0)), 1),
            center_wgs84=[float(center_lon), float(center_lat)],
            heading_deg=float(heading_deg),
            status="success",
            message=f"3D building generated successfully ({meta.get('floors', 2)} floors, {round(footprint_sqm, 1)} m² footprint)",
            disclaimer="Preliminary check — not legal or regulatory approval",
            metadata=meta,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")
