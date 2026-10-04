"""
GeoBuild AI — Procedural Geometry Package
Coordinate transformations, regulatory footprint clipping, and 3D GLB procedural generation.
"""

from .projection import (
    get_utm_epsg_for_city,
    wgs84_to_utm,
    utm_to_wgs84,
    polygon_wgs84_to_utm,
    polygon_utm_to_wgs84,
)
from .footprint import (
    compute_buildable_footprint,
    compute_polygon_area_marla,
    MARLA_TO_SQM,
)
from .generator import generate_building_glb, load_facade_presets

__all__ = [
    "get_utm_epsg_for_city",
    "wgs84_to_utm",
    "utm_to_wgs84",
    "polygon_wgs84_to_utm",
    "polygon_utm_to_wgs84",
    "compute_buildable_footprint",
    "compute_polygon_area_marla",
    "MARLA_TO_SQM",
    "generate_building_glb",
    "load_facade_presets",
]
