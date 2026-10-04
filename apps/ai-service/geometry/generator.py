"""
GeoBuild AI — Procedural 3D Generator
Generates procedural 3D GLB models from BuildingSpec and plot footprint geometry.
Rule 11: Procedural geometry only — no AI-generated meshes.
Rule 12: All 3D output is GLB format.
Rule 13: Use trimesh for extrusion and manifold3d for CSG operations.
Rule 14: Facade styles come from data/styles/*.json, never hardcoded.
Rule 7: All internal measurements are in metres.
"""

from __future__ import annotations
import io
import json
import os
from typing import Any
import numpy as np
from shapely.geometry import Polygon, MultiPolygon
import trimesh

try:
    import manifold3d
    HAS_MANIFOLD = True
except ImportError:
    HAS_MANIFOLD = False

from models import BuildingSpec

# Path to styles directory
STYLES_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "data", "styles")
)


def load_facade_presets() -> dict[str, Any]:
    """Load facade style presets from data/styles/facade_presets.json (Rule 14)."""
    preset_file = os.path.join(STYLES_DIR, "facade_presets.json")
    if os.path.exists(preset_file):
        with open(preset_file, "r", encoding="utf-8") as f:
            return json.load(f)
    # Sensible fallback matching the schema
    return {
        "contemporary_pakistani": {
            "name": "Contemporary Pakistani",
            "colors": {"primary": "#D4B896", "secondary": "#8B4513", "accent": "#2C3E50", "trim": "#FFFFFF"}
        }
    }


def _hex_to_rgba(hex_code: str, alpha: int = 255) -> list[int]:
    """Convert hex string (e.g., #D4B896) to [R, G, B, A] uint8."""
    hex_clean = hex_code.lstrip("#")
    if len(hex_clean) == 6:
        return [
            int(hex_clean[0:2], 16),
            int(hex_clean[2:4], 16),
            int(hex_clean[4:6], 16),
            alpha,
        ]
    return [210, 190, 165, alpha]


def _set_mesh_color(mesh: trimesh.Trimesh, rgba: list[int]) -> trimesh.Trimesh:
    """Set uniform RGBA color for all vertices in a mesh."""
    color_arr = np.tile(np.array(rgba, dtype=np.uint8), (len(mesh.vertices), 1))
    mesh.visual.vertex_colors = color_arr
    return mesh


def generate_building_glb(
    footprint_poly: Polygon,
    spec: BuildingSpec,
    plot_utm: list[list[float]] | None = None,
    center_at_origin: bool = True,
) -> tuple[bytes, dict[str, Any]]:
    """
    Generate a complete procedural 3D GLB building model.
    Returns (glb_bytes, metadata).
    """
    presets = load_facade_presets()
    style_key = spec.facade.style if spec.facade else "contemporary_pakistani"
    style_info = presets.get(style_key, presets.get("contemporary_pakistani", {}))
    colors = style_info.get("colors", {
        "primary": "#D4B896",
        "secondary": "#8B4513",
        "accent": "#2C3E50",
        "trim": "#FFFFFF",
    })

    primary_rgba = _hex_to_rgba(colors.get("primary", "#D4B896"))
    secondary_rgba = _hex_to_rgba(colors.get("secondary", "#8B4513"))
    accent_rgba = _hex_to_rgba(colors.get("accent", "#2C3E50"))
    trim_rgba = _hex_to_rgba(colors.get("trim", "#FFFFFF"))
    glass_rgba = [160, 210, 235, 180]
    roof_rgba = [80, 85, 90, 255]
    tank_rgba = [60, 100, 160, 255]

    # Center polygon at local origin (0, 0)
    centroid = footprint_poly.centroid
    cx, cy = centroid.x, centroid.y

    if center_at_origin:
        from shapely.affinity import translate
        poly_local = translate(footprint_poly, xoff=-cx, yoff=-cy)
    else:
        poly_local = footprint_poly

    meshes: list[trimesh.Trimesh] = []

    floor_h = spec.floorHeightM
    floors = spec.floors
    has_basement = spec.basement

    # 1. Basement (if configured)
    if has_basement:
        base_mesh = trimesh.creation.extrude_polygon(poly_local, height=floor_h)
        base_mesh.apply_translation([0, 0, -floor_h])
        _set_mesh_color(base_mesh, [120, 115, 110, 255])
        meshes.append(base_mesh)

    # 2. Above-ground floors extrusion
    for f in range(floors):
        z_start = f * floor_h
        floor_mesh = trimesh.creation.extrude_polygon(poly_local, height=floor_h)
        floor_mesh.apply_translation([0, 0, z_start])
        _set_mesh_color(floor_mesh, primary_rgba)
        meshes.append(floor_mesh)

        # Floor separator slab/band (Cornice / Trim)
        slab_mesh = trimesh.creation.extrude_polygon(poly_local.buffer(0.12), height=0.18)
        slab_mesh.apply_translation([0, 0, z_start + floor_h - 0.09])
        _set_mesh_color(slab_mesh, secondary_rgba)
        meshes.append(slab_mesh)

        # Windows and Facade details on front wall
        # Calculate bounding box of local polygon to place front features
        minx, miny, maxx, maxy = poly_local.bounds
        width = maxx - minx
        front_y = miny

        # Add window panes on front facade
        n_windows = max(2, min(5, int(width / 2.5)))
        w_width = min(1.4, (width * 0.7) / n_windows)
        w_height = min(1.6, floor_h * 0.55)
        w_z = z_start + (floor_h - w_height) * 0.55

        x_spacing = width / (n_windows + 1)
        for w_idx in range(n_windows):
            wx = minx + x_spacing * (w_idx + 1)
            # Window frame (accent color)
            frame_box = trimesh.creation.box(extents=[w_width + 0.15, 0.2, w_height + 0.15])
            frame_box.apply_translation([wx, front_y - 0.05, w_z + w_height * 0.5])
            _set_mesh_color(frame_box, secondary_rgba)
            meshes.append(frame_box)

            # Window glass
            glass_box = trimesh.creation.box(extents=[w_width, 0.12, w_height])
            glass_box.apply_translation([wx, front_y - 0.06, w_z + w_height * 0.5])
            _set_mesh_color(glass_box, glass_rgba)
            meshes.append(glass_box)

    # 3. Balcony on floor 2 if requested and multi-storey
    if floors >= 2 and (spec.facade.hasBalcony if spec.facade else True):
        minx, miny, maxx, maxy = poly_local.bounds
        balcony_w = (maxx - minx) * 0.45
        balcony_d = 1.4
        balcony_h = 0.15
        balcony_z = floor_h

        # Slab
        b_slab = trimesh.creation.box(extents=[balcony_w, balcony_d, balcony_h])
        b_slab.apply_translation([0, miny - balcony_d * 0.5, balcony_z])
        _set_mesh_color(b_slab, trim_rgba)
        meshes.append(b_slab)

        # Railing
        railing = trimesh.creation.box(extents=[balcony_w, 0.08, 0.9])
        railing.apply_translation([0, miny - balcony_d + 0.04, balcony_z + 0.45])
        _set_mesh_color(railing, accent_rgba)
        meshes.append(railing)

    # 4. Jali screens (Pakistani architectural feature)
    if spec.facade and spec.facade.hasJali:
        minx, miny, maxx, maxy = poly_local.bounds
        jali_w = 1.2
        jali_h = floor_h * 0.8
        jali_z = (floors - 1) * floor_h + floor_h * 0.1
        # Place jali on one side of front facade
        jali_x = minx + (maxx - minx) * 0.82
        jali_box = trimesh.creation.box(extents=[jali_w, 0.18, jali_h])
        jali_box.apply_translation([jali_x, miny - 0.08, jali_z + jali_h * 0.5])
        _set_mesh_color(jali_box, accent_rgba)
        meshes.append(jali_box)

    # 5. Roof level (Parapet, Terrace, Water tank, Pergola)
    roof_z = floors * floor_h
    # Roof slab
    roof_mesh = trimesh.creation.extrude_polygon(poly_local, height=0.2)
    roof_mesh.apply_translation([0, 0, roof_z])
    _set_mesh_color(roof_mesh, roof_rgba)
    meshes.append(roof_mesh)

    # Parapet wall around roof
    parapet_h = 1.1 if spec.rooftopTerrace else 0.8
    # Outer parapet boundary minus inner hole
    inner_poly = poly_local.buffer(-0.25)
    if not inner_poly.is_empty and inner_poly.area > 2.0:
        parapet_poly = poly_local.difference(inner_poly)
        if isinstance(parapet_poly, MultiPolygon):
            parapet_poly = max(parapet_poly.geoms, key=lambda g: g.area)
        parapet_mesh = trimesh.creation.extrude_polygon(parapet_poly, height=parapet_h)
        parapet_mesh.apply_translation([0, 0, roof_z + 0.2])
        _set_mesh_color(parapet_mesh, primary_rgba)
        meshes.append(parapet_mesh)

    # Overhead water tank (standard Pakistani residential requirement)
    if spec.waterTank:
        tank_w, tank_l, tank_h = 1.8, 2.2, 1.5
        tank_box = trimesh.creation.box(extents=[tank_w, tank_l, tank_h])
        tank_box.apply_translation([cx * 0.1, cy * 0.1 + 1.0, roof_z + 0.2 + tank_h * 0.5])
        _set_mesh_color(tank_box, tank_rgba)
        meshes.append(tank_box)

    # Rooftop Pergola
    if spec.rooftopPergola and spec.rooftopTerrace:
        minx, miny, maxx, maxy = poly_local.bounds
        perg_w = (maxx - minx) * 0.4
        perg_d = (maxy - miny) * 0.4
        perg_h = 2.4
        # Pergola top beams
        for bi in range(5):
            beam = trimesh.creation.box(extents=[perg_w, 0.1, 0.15])
            beam.apply_translation([0, -perg_d * 0.5 + bi * (perg_d / 4), roof_z + 0.2 + perg_h])
            _set_mesh_color(beam, secondary_rgba)
            meshes.append(beam)

    # Mughal-inspired accent (dome feature on roof)
    if style_key == "mughal_inspired":
        dome = trimesh.creation.icosphere(subdivisions=2, radius=1.2)
        dome.apply_scale([1.0, 1.0, 1.3])
        dome.apply_translation([0, 0, roof_z + 0.2 + 1.2])
        _set_mesh_color(dome, trim_rgba)
        meshes.append(dome)

    # 6. Boundary wall with Gate around plot (if plot provided)
    if spec.boundaryWall and plot_utm:
        from shapely.geometry import Polygon as ShpPolygon
        plot_poly = ShpPolygon(plot_utm)
        if center_at_origin:
            from shapely.affinity import translate
            plot_poly_local = translate(plot_poly, xoff=-cx, yoff=-cy)
        else:
            plot_poly_local = plot_poly

        inner_plot = plot_poly_local.buffer(-0.25)
        if not inner_plot.is_empty and inner_plot.area > 5.0:
            wall_poly = plot_poly_local.difference(inner_plot)
            if isinstance(wall_poly, MultiPolygon):
                wall_poly = max(wall_poly.geoms, key=lambda g: g.area)
            wall_mesh = trimesh.creation.extrude_polygon(wall_poly, height=2.1)
            _set_mesh_color(wall_mesh, [190, 185, 175, 255])
            meshes.append(wall_mesh)

            # Gate opening in front
            # Gate posts
            pminx, pminy, pmaxx, pmaxy = plot_poly_local.bounds
            gate_w = 3.6  # 12 ft driveway gate
            g_post1 = trimesh.creation.box(extents=[0.5, 0.5, 2.4])
            g_post1.apply_translation([-gate_w * 0.5, pminy, 1.2])
            _set_mesh_color(g_post1, secondary_rgba)
            meshes.append(g_post1)

            g_post2 = trimesh.creation.box(extents=[0.5, 0.5, 2.4])
            g_post2.apply_translation([gate_w * 0.5, pminy, 1.2])
            _set_mesh_color(g_post2, secondary_rgba)
            meshes.append(g_post2)

    # Combine into a single trimesh.Scene
    scene = trimesh.Scene()
    for idx, m in enumerate(meshes):
        scene.add_geometry(m, node_name=f"mesh_{idx}")

    # Export to GLB format (Rule 12)
    glb_data = scene.export(file_type="glb")
    if isinstance(glb_data, str):
        glb_bytes = glb_data.encode("utf-8")
    else:
        glb_bytes = bytes(glb_data)

    total_height = floors * floor_h + (parapet_h if spec.rooftopTerrace else 0)
    metadata = {
        "footprint_sqm": float(footprint_poly.area),
        "total_height_m": total_height,
        "floors": floors,
        "has_basement": has_basement,
        "centroid_utm": [float(cx), float(cy)],
        "facade_style": style_key,
        "mesh_count": len(meshes),
        "glb_size_bytes": len(glb_bytes),
    }

    return glb_bytes, metadata
