"""
GeoBuild AI — Generate Router
Placeholder for 3D model generation endpoint.
Will generate procedural GLB models from BuildingSpec + plot geometry.
"""

from fastapi import APIRouter
from pydantic import BaseModel, Field
from models import BuildingSpec

router = APIRouter()


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
    building_footprint_sqm: float = 0
    total_height_m: float = 0
    status: str = "pending"
    message: str = ""


@router.post("/generate", response_model=GenerateResponse)
async def generate_model(request: GenerateRequest):
    """
    Generate a 3D GLB model from a BuildingSpec and plot geometry.
    
    TODO: Implement in Weeks 4-8
    - Project plot to UTM
    - Apply setbacks with shapely
    - Extrude floors with trimesh
    - Cut windows/doors with manifold3d
    - Apply facade preset
    - Export GLB
    """
    return GenerateResponse(
        status="not_implemented",
        message="3D generation endpoint is planned for Weeks 4-8. "
                "Use the /interpret and /patch endpoints to work with BuildingSpecs.",
    )
