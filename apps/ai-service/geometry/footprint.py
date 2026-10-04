"""
GeoBuild AI — Footprint and Setback Module
Calculates plot area, marla conversion, and buildable footprint by applying setbacks.
Rule 7: All internal measurements are in metres.
Rule 10: 1 marla ≈ 25.2929 m² (≈ 272.25 sq ft).
"""

from typing import Any
import numpy as np
from shapely.geometry import Polygon, LineString, MultiPolygon
from shapely.ops import clip_by_rect
import shapely.affinity as affinity

# 1 marla ≈ 25.2929 m² (Rule 10)
MARLA_TO_SQM = 25.2929
SQM_TO_SQFT = 10.7639


def compute_polygon_area_marla(plot_utm: list[list[float]]) -> tuple[float, float]:
    """
    Calculate plot area in marla and square metres from UTM coordinates.
    Returns (area_marla, area_sqm).
    """
    poly = Polygon(plot_utm)
    area_sqm = float(poly.area)
    area_marla = float(area_sqm / MARLA_TO_SQM)
    return area_marla, area_sqm


def compute_buildable_footprint(
    plot_utm: list[list[float]],
    front_edge_idx: int = 0,
    setbacks: dict[str, float] | None = None,
) -> tuple[Polygon, float]:
    """
    Compute buildable footprint polygon from plot UTM boundary and setbacks.
    
    setbacks dictionary:
      - 'front': float (metres)
      - 'back': float (metres)
      - 'left': float (metres)
      - 'right': float (metres)
    """
    if setbacks is None:
        setbacks = {"front": 1.5, "back": 1.5, "left": 0.0, "right": 0.0}

    plot_poly = Polygon(plot_utm)
    if not plot_poly.is_valid:
        plot_poly = plot_poly.buffer(0)

    # If simple polygon with 4 sides, we can calculate directed edge offsets
    coords = list(plot_poly.exterior.coords)
    if coords[0] == coords[-1]:
        coords = coords[:-1]
    n_pts = len(coords)

    # General inward buffer as baseline or fallback
    min_sb = min(setbacks.values())
    max_sb = max(setbacks.values())
    avg_sb = sum(setbacks.values()) / max(len(setbacks), 1)

    if n_pts == 4 and max_sb > 0:
        # Reorder vertices so front_edge_idx is index 0
        ordered = [coords[(front_edge_idx + i) % 4] for i in range(4)]
        # Edge 0: Front
        # Edge 1: Right
        # Edge 2: Back
        # Edge 3: Left
        sb_front = setbacks.get("front", 1.5)
        sb_right = setbacks.get("right", 0.0)
        sb_back = setbacks.get("back", 1.5)
        sb_left = setbacks.get("left", 0.0)

        # Inward half-plane clipping for each edge
        curr_poly = plot_poly
        edge_setbacks = [sb_front, sb_right, sb_back, sb_left]
        
        centroid = plot_poly.centroid
        for i in range(4):
            sb = edge_setbacks[i]
            if sb <= 0.01:
                continue
            p1 = np.array(ordered[i])
            p2 = np.array(ordered[(i + 1) % 4])
            edge_vec = p2 - p1
            edge_len = np.linalg.norm(edge_vec)
            if edge_len < 1e-6:
                continue
            # Normal pointing towards centroid
            normal = np.array([-edge_vec[1], edge_vec[0]]) / edge_len
            midpoint = (p1 + p2) / 2.0
            # Ensure normal points inward towards centroid
            to_centroid = np.array([centroid.x - midpoint[0], centroid.y - midpoint[1]])
            if np.dot(normal, to_centroid) < 0:
                normal = -normal

            # Shift the edge inward by sb
            offset_mid = midpoint + normal * sb
            # Create a large cutting half-plane or buffer
            # Simplified: test line offset
            offset_line_p1 = (p1 + normal * sb) - edge_vec * 5.0
            offset_line_p2 = (p2 + normal * sb) + edge_vec * 5.0
            
            # Construct a half-plane polygon containing centroid
            far_offset = normal * 1000.0
            half_plane = Polygon([
                offset_line_p1,
                offset_line_p2,
                offset_line_p2 + far_offset,
                offset_line_p1 + far_offset,
            ])
            if half_plane.is_valid and curr_poly.intersects(half_plane):
                clipped = curr_poly.intersection(half_plane)
                if not clipped.is_empty and clipped.area > 5.0:
                    if isinstance(clipped, MultiPolygon):
                        clipped = max(clipped.geoms, key=lambda g: g.area)
                    curr_poly = clipped

        if curr_poly.is_valid and curr_poly.area > 5.0:
            return curr_poly, float(curr_poly.area)

    # Fallback to buffer with average setback
    buffer_dist = -max(avg_sb, 0.5)
    buffered = plot_poly.buffer(buffer_dist)
    if not buffered.is_empty and buffered.area > 5.0:
        if isinstance(buffered, MultiPolygon):
            buffered = max(buffered.geoms, key=lambda g: g.area)
        return buffered, float(buffered.area)

    # If setback buffer made it too small, scale inward by 85%
    scaled = affinity.scale(plot_poly, xfact=0.85, yfact=0.85, origin='centroid')
    return scaled, float(scaled.area)
