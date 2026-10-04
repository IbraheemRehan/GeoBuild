"""
GeoBuild AI — Footprint and Setback Module
Calculates plot area, marla conversion, canonical orientation, and buildable footprint.
Rule 7: All internal measurements are in metres.
Rule 10: 1 marla ≈ 25.2929 m² (≈ 272.25 sq ft).
"""

from typing import Any
import math
import numpy as np
from shapely.geometry import Polygon, MultiPolygon
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
    if not poly.is_valid:
        poly = poly.buffer(0)
    area_sqm = float(poly.area)
    area_marla = float(area_sqm / MARLA_TO_SQM)
    return area_marla, area_sqm


def get_canonical_frame(
    plot_utm: list[list[float]],
    front_edge_idx: int = 0,
) -> dict[str, Any]:
    """
    Compute a canonical 2D coordinate system for the plot where:
      - Origin (0, 0) is at the plot centroid.
      - +X axis is tangent to the front street edge (from left to right along the street).
      - +Y axis is normal pointing inward into the plot depth (from street toward rear).
      - Front street is at minimum Y.
      - Rear of the plot is at maximum Y.
    """
    plot_poly = Polygon(plot_utm)
    if not plot_poly.is_valid:
        plot_poly = plot_poly.buffer(0)

    coords = list(plot_poly.exterior.coords)
    if coords[0] == coords[-1]:
        coords = coords[:-1]
    n_pts = len(coords)

    centroid = plot_poly.centroid
    cx, cy = centroid.x, centroid.y
    c_arr = np.array([cx, cy])

    # Front edge vector (Edge from front_edge_idx to next vertex)
    f_idx = front_edge_idx % n_pts
    next_idx = (f_idx + 1) % n_pts
    p0 = np.array(coords[f_idx])
    p1 = np.array(coords[next_idx])

    edge_vec = p1 - p0
    edge_len = np.linalg.norm(edge_vec)
    if edge_len < 1e-6:
        u_vec = np.array([1.0, 0.0])
    else:
        u_vec = edge_vec / edge_len

    # Normal vector perpendicular to u_vec pointing inward into plot depth
    v_vec = np.array([-u_vec[1], u_vec[0]])
    midpoint = (p0 + p1) / 2.0
    to_centroid = c_arr - midpoint
    if np.dot(v_vec, to_centroid) < 0:
        v_vec = -v_vec

    # Calculate real-world street heading angle in degrees clockwise from North
    # u_vec is [dx, dy] where dx is Easting and dy is Northing
    street_angle_rad = math.atan2(u_vec[0], u_vec[1])
    street_heading_deg = (math.degrees(street_angle_rad) + 360.0) % 360.0
    # Cesium heading relative to ENU frame (when u_vec is East, heading is 0)
    cesium_heading_deg = (street_heading_deg - 90.0) % 360.0

    # Project all vertices into canonical (x, y)
    canonical_coords: list[tuple[float, float]] = []
    for pt in coords:
        p_arr = np.array(pt) - c_arr
        x_local = float(np.dot(p_arr, u_vec))
        y_local = float(np.dot(p_arr, v_vec))
        canonical_coords.append((x_local, y_local))

    canonical_poly = Polygon(canonical_coords)
    if not canonical_poly.is_valid:
        canonical_poly = canonical_poly.buffer(0)

    minx, miny, maxx, maxy = canonical_poly.bounds

    return {
        "centroid": (float(cx), float(cy)),
        "u_vec": u_vec,
        "v_vec": v_vec,
        "coords_canonical": canonical_coords,
        "poly_canonical": canonical_poly,
        "bounds": (minx, miny, maxx, maxy),
        "width": float(maxx - minx),
        "depth": float(maxy - miny),
        "street_heading_deg": street_heading_deg,
        "cesium_heading_deg": cesium_heading_deg,
    }


def compute_buildable_footprint(
    plot_utm: list[list[float]],
    front_edge_idx: int = 0,
    setbacks: dict[str, float] | None = None,
) -> tuple[Polygon, float, dict[str, Any]]:
    """
    Compute buildable footprint polygon respecting Pakistani setbacks.
    Returns (footprint_canonical_poly, footprint_sqm, frame_info).
    """
    if setbacks is None:
        setbacks = {"front": 1.5, "back": 1.5, "left": 0.0, "right": 0.0}

    frame = get_canonical_frame(plot_utm, front_edge_idx=front_edge_idx)
    poly_can = frame["poly_canonical"]
    minx, miny, maxx, maxy = frame["bounds"]
    width = frame["width"]
    depth = frame["depth"]

    sb_front = float(setbacks.get("front", 1.5))
    sb_back = float(setbacks.get("back", 1.5))
    sb_left = float(setbacks.get("left", 0.0))
    sb_right = float(setbacks.get("right", 0.0))

    # For 4-sided plots (standard Pakistani plots: 5 Marla, 10 Marla, 1 Kanal, 2 Kanal)
    coords = frame["coords_canonical"]
    if len(coords) == 4 and width > 4.0 and depth > 6.0:
        # Construct exact buildable box in canonical coordinates
        # Front is at miny, rear is at maxy
        # Left is at minx, right is at maxx
        buildable_min_x = minx + sb_left
        buildable_max_x = maxx - sb_right
        buildable_min_y = miny + sb_front
        buildable_max_y = maxy - sb_back

        # Ensure valid dimensions
        if buildable_max_x > buildable_min_x + 3.0 and buildable_max_y > buildable_min_y + 4.0:
            box_poly = Polygon([
                (buildable_min_x, buildable_min_y),
                (buildable_max_x, buildable_min_y),
                (buildable_max_x, buildable_max_y),
                (buildable_min_x, buildable_max_y),
            ])
            return box_poly, float(box_poly.area), frame

    # General polygon setback calculation: buffer inward
    avg_sb = (sb_front + sb_back + sb_left + sb_right) / 4.0
    buffer_dist = -max(avg_sb, 0.8)
    buffered = poly_can.buffer(buffer_dist)
    if not buffered.is_empty and buffered.area > 10.0:
        if isinstance(buffered, MultiPolygon):
            buffered = max(buffered.geoms, key=lambda g: g.area)
        return buffered, float(buffered.area), frame

    # Fallback: Scale inward by 82%
    scaled = affinity.scale(poly_can, xfact=0.82, yfact=0.82, origin=(0, 0))
    return scaled, float(scaled.area), frame
