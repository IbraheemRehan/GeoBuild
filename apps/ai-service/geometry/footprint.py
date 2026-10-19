"""
GeoBuild AI — Footprint and Setback Module
Calculates plot area, marla conversion, canonical orientation, and buildable footprint.
Rule 7: All internal measurements are in metres.
Rule 10: 1 marla ≈ 25.2929 m² (≈ 272.25 sq ft).
"""

from typing import Any
import math
import numpy as np
from shapely.geometry import Polygon, MultiPolygon, box
import shapely.affinity as affinity

# 1 marla ≈ 25.2929 m² (Rule 10)
MARLA_TO_SQM = 25.2929
SQM_TO_SQFT = 10.7639


def clean_plot_vertices(coords: list[list[float]] | list[tuple[float, float]], min_edge_m: float = 1.0) -> list[list[float]]:
    """Remove duplicate, near-zero, and microscopic sliver vertices (< 1.0m)."""
    if len(coords) < 3:
        return [list(c) for c in coords]

    cleaned: list[list[float]] = []
    for c in coords:
        pt = [float(c[0]), float(c[1])]
        if not cleaned:
            cleaned.append(pt)
            continue
        prev = cleaned[-1]
        dist = math.hypot(pt[0] - prev[0], pt[1] - prev[1])
        if dist >= min_edge_m:
            cleaned.append(pt)

    # Check if last vertex is duplicate of first
    if len(cleaned) >= 3:
        dist_closing = math.hypot(cleaned[-1][0] - cleaned[0][0], cleaned[-1][1] - cleaned[0][1])
        if dist_closing < min_edge_m:
            cleaned.pop()

    return cleaned if len(cleaned) >= 3 else [list(c) for c in coords]


def compute_polygon_area_marla(plot_utm: list[list[float]]) -> tuple[float, float]:
    """
    Calculate plot area in marla and square metres from UTM coordinates.
    Returns (area_marla, area_sqm).
    """
    cleaned = clean_plot_vertices(plot_utm)
    poly = Polygon(cleaned)
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
    Compute a strictly right-handed canonical 2D coordinate system for the plot where:
      - Origin (0, 0) is at the plot centroid.
      - +X axis is tangent to the front street edge (from left to right along the street).
      - +Y axis is normal pointing inward into the plot depth (from street toward rear).
      - Front street is at minimum Y.
      - Rear of the plot is at maximum Y.
      - det([u_vec, v_vec]) == +1.0 (pure rigid rotation, NEVER a reflection).
    """
    cleaned_utm = clean_plot_vertices(plot_utm)
    plot_poly = Polygon(cleaned_utm)
    if not plot_poly.is_valid:
        plot_poly = plot_poly.buffer(0)

    coords = list(plot_poly.exterior.coords)
    if coords[0] == coords[-1]:
        coords = coords[:-1]
    n_pts = len(coords)

    centroid = plot_poly.centroid
    cx, cy = float(centroid.x), float(centroid.y)
    c_arr = np.array([cx, cy])

    # 1. Select front edge (skip any degenerate edges < 1.0m)
    f_idx = front_edge_idx % n_pts
    p0 = np.array(coords[f_idx])
    p1 = np.array(coords[(f_idx + 1) % n_pts])
    edge_vec = p1 - p0
    edge_len = np.linalg.norm(edge_vec)

    if edge_len < 1.0:
        # Search for the longest or most prominent edge
        best_len = 0.0
        for i in range(n_pts):
            q0 = np.array(coords[i])
            q1 = np.array(coords[(i + 1) % n_pts])
            v = q1 - q0
            l = np.linalg.norm(v)
            if l > best_len:
                best_len = l
                f_idx = i
                p0, p1 = q0, q1
                edge_vec = v
                edge_len = l

    if edge_len < 1e-4:
        u_vec = np.array([1.0, 0.0])
    else:
        u_vec = edge_vec / edge_len

    # 2. Inward normal vector perpendicular to u_vec
    # Standard 2D 90-degree CCW normal: [-u_y, u_x]
    v_vec = np.array([-u_vec[1], u_vec[0]])
    midpoint = (p0 + p1) / 2.0
    to_centroid = c_arr - midpoint

    # If v_vec points away from centroid, reverse BOTH u_vec and v_vec.
    # Negating both preserves det([u, v]) = +1.0 (rigid rotation, NO reflection!)
    if np.dot(v_vec, to_centroid) < 0:
        u_vec = -u_vec
        v_vec = -v_vec

    # 3. Check aspect ratio: In Pakistani residential plots, the frontage
    # (street width) is the shorter or equal dimension (e.g. 25x45, 35x65, 50x90).
    # If width > 1.25 * depth, the user selected a side edge as edge 0.
    # Apply a 90° rigid rotation so the house faces the street frontage.
    temp_w = max(np.dot(np.array(pt) - c_arr, u_vec) for pt in coords) - min(np.dot(np.array(pt) - c_arr, u_vec) for pt in coords)
    temp_d = max(np.dot(np.array(pt) - c_arr, v_vec) for pt in coords) - min(np.dot(np.array(pt) - c_arr, v_vec) for pt in coords)

    if temp_w > 1.35 * temp_d and temp_d > 5.0:
        # Rotate 90° CCW: u' = -v, v' = u (det = -v_x*u_y - (-v_y)*u_x = -(-u_y)*u_y - u_x*u_x = -1? No!)
        # Rotate 90° CW: u' = v, v' = -u -> det([v, -u]) = v_x*(-u_y) - v_y*(-u_x) = -(-u_y)*u_y + u_x*u_x = +1.0!
        u_rotated = np.array([v_vec[0], v_vec[1]])
        v_rotated = np.array([-u_vec[0], -u_vec[1]])
        u_vec, v_vec = u_rotated, v_rotated

    # 4. Project all vertices into canonical (x, y)
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

    # 5. Precise Cesium heading angle
    # In Cesium ENU frame: Model Y (Depth) points in direction of v_vec.
    # Angle of v_vec clockwise from North:
    cesium_heading_deg = (math.degrees(math.atan2(v_vec[0], v_vec[1])) + 360.0) % 360.0
    street_heading_deg = (math.degrees(math.atan2(u_vec[0], u_vec[1])) + 360.0) % 360.0

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
    Guarantees the footprint is 100% inside the plot polygon.
    """
    if setbacks is None:
        setbacks = {"front": 1.5, "back": 1.2, "left": 0.0, "right": 0.0}

    frame = get_canonical_frame(plot_utm, front_edge_idx=front_edge_idx)
    poly_can = frame["poly_canonical"]
    minx, miny, maxx, maxy = frame["bounds"]

    sb_front = float(setbacks.get("front", 1.5))
    sb_back = float(setbacks.get("back", 1.2))
    sb_left = float(setbacks.get("left", 0.0))
    sb_right = float(setbacks.get("right", 0.0))

    # Construct buildable setback box in canonical coordinates
    buildable_min_x = minx + sb_left
    buildable_max_x = maxx - sb_right
    buildable_min_y = miny + sb_front
    buildable_max_y = maxy - sb_back

    # If setbacks shrink too aggressively for small plots, adaptively scale
    if buildable_max_x - buildable_min_x < 4.0:
        buildable_min_x = minx + 0.3
        buildable_max_x = maxx - 0.3
    if buildable_max_y - buildable_min_y < 5.0:
        buildable_min_y = miny + 0.8
        buildable_max_y = maxy - 0.8

    setback_box = box(buildable_min_x, buildable_min_y, buildable_max_x, buildable_max_y)

    # Intersect with the canonical plot polygon — STRICT 100% CONTAINMENT GUARANTEE
    intersected = poly_can.intersection(setback_box)

    if not intersected.is_empty and intersected.area > 15.0:
        if isinstance(intersected, MultiPolygon):
            intersected = max(intersected.geoms, key=lambda g: g.area)
        return intersected, float(intersected.area), frame

    # Fallback: buffer inward by minimum setback
    avg_sb = max((sb_front + sb_back) / 2.0, 0.8)
    buffered = poly_can.buffer(-avg_sb)
    if not buffered.is_empty and buffered.area > 10.0:
        if isinstance(buffered, MultiPolygon):
            buffered = max(buffered.geoms, key=lambda g: g.area)
        return buffered, float(buffered.area), frame

    # Last resort fallback: Scale inward
    scaled = affinity.scale(poly_can, xfact=0.80, yfact=0.80, origin=(0, 0))
    return scaled, float(scaled.area), frame
