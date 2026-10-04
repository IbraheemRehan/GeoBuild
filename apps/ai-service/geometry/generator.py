"""
GeoBuild AI — Procedural 3D Generator
Generates realistic, photorealistic procedural 3D GLB building models.
Rule 11: Procedural geometry only — no AI-generated meshes.
Rule 12: All 3D output is GLB format.
Rule 13: Use trimesh for extrusion.
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
    return {
        "contemporary_pakistani": {
            "name": "Contemporary Pakistani",
            "colors": {"primary": "#EDE7DE", "secondary": "#2B303A", "accent": "#7C4A28", "trim": "#FFFFFF"}
        }
    }


def _hex_to_rgba(hex_code: str, alpha: int = 255) -> list[int]:
    """Convert hex string (e.g. #D4B896) to [R, G, B, A] uint8."""
    hex_clean = hex_code.lstrip("#")
    if len(hex_clean) == 6:
        return [
            int(hex_clean[0:2], 16),
            int(hex_clean[2:4], 16),
            int(hex_clean[4:6], 16),
            alpha,
        ]
    return [230, 225, 215, alpha]


def _set_mesh_color(mesh: trimesh.Trimesh, rgba: list[int]) -> trimesh.Trimesh:
    """Set uniform RGBA color for all vertices in a mesh."""
    color_arr = np.tile(np.array(rgba, dtype=np.uint8), (len(mesh.vertices), 1))
    mesh.visual.vertex_colors = color_arr
    return mesh


def generate_building_glb(
    footprint_poly: Polygon,
    spec: BuildingSpec,
    plot_poly: Polygon | None = None,
) -> tuple[bytes, dict[str, Any]]:
    """
    Generate a complete procedural 3D GLB building model in canonical coordinates.
    Canonical orientation:
      - Front street is at minimum Y.
      - Rear of plot is at maximum Y.
      - Width is along X.
      - Depth is along Y.
      - Z is Up (height).
    Returns (glb_bytes, metadata).
    """
    presets = load_facade_presets()
    style_key = spec.facade.style if spec.facade else "contemporary_pakistani"
    style_info = presets.get(style_key, presets.get("contemporary_pakistani", {}))
    colors = style_info.get("colors", {
        "primary": "#EDE7DE",
        "secondary": "#2B303A",
        "accent": "#7C4A28",
        "trim": "#E2E8F0",
    })

    primary_rgba = _hex_to_rgba(colors.get("primary", "#EDE7DE"))
    secondary_rgba = _hex_to_rgba(colors.get("secondary", "#2B303A"))
    accent_rgba = _hex_to_rgba(colors.get("accent", "#7C4A28"))
    trim_rgba = _hex_to_rgba(colors.get("trim", "#E2E8F0"))

    glass_rgba = [130, 185, 220, 190]
    pavement_rgba = [60, 65, 75, 255]
    roof_rgba = [70, 75, 82, 255]
    tank_rgba = [45, 80, 140, 255]
    door_rgba = [65, 40, 25, 255]
    grass_rgba = [75, 120, 60, 255]

    meshes: list[trimesh.Trimesh] = []

    floor_h = float(spec.floorHeightM)
    floors = int(spec.floors)
    has_basement = bool(spec.basement)

    # Buildable footprint bounds
    minx, miny, maxx, maxy = footprint_poly.bounds
    b_width = maxx - minx
    b_depth = maxy - miny
    front_y = miny

    # Plot bounds (if provided)
    if plot_poly:
        pminx, pminy, pmaxx, pmaxy = plot_poly.bounds
    else:
        pminx, pminy, pmaxx, pmaxy = minx - 0.5, miny - 3.0, maxx + 0.5, maxy + 2.0

    # ----------------------------------------------------
    # 1. Driveway / Front Paved Yard & Lawn
    # ----------------------------------------------------
    front_setback_depth = front_y - pminy
    if front_setback_depth > 1.0:
        # Driveway slab for car parking
        driveway_w = min(b_width, 6.0)
        driveway_mesh = trimesh.creation.box(extents=[driveway_w, front_setback_depth - 0.2, 0.08])
        driveway_mesh.apply_translation([-b_width * 0.15, pminy + (front_setback_depth - 0.2) * 0.5, 0.04])
        _set_mesh_color(driveway_mesh, pavement_rgba)
        meshes.append(driveway_mesh)

        # Front lawn green patch on the opposite side
        lawn_w = b_width - driveway_w - 0.4
        if lawn_w > 1.5:
            lawn_mesh = trimesh.creation.box(extents=[lawn_w, front_setback_depth - 0.4, 0.06])
            lawn_mesh.apply_translation([b_width * 0.35, pminy + (front_setback_depth - 0.4) * 0.5 + 0.1, 0.03])
            _set_mesh_color(lawn_mesh, grass_rgba)
            meshes.append(lawn_mesh)

    # ----------------------------------------------------
    # 2. Basement (if configured)
    # ----------------------------------------------------
    if has_basement:
        base_mesh = trimesh.creation.extrude_polygon(footprint_poly, height=floor_h)
        base_mesh.apply_translation([0, 0, -floor_h])
        _set_mesh_color(base_mesh, [100, 105, 115, 255])
        meshes.append(base_mesh)

    # ----------------------------------------------------
    # 3. Above-Ground Floors Extrusion
    # ----------------------------------------------------
    for f in range(floors):
        z_start = f * floor_h

        # Main floor volume
        floor_mesh = trimesh.creation.extrude_polygon(footprint_poly, height=floor_h)
        floor_mesh.apply_translation([0, 0, z_start])
        _set_mesh_color(floor_mesh, primary_rgba)
        meshes.append(floor_mesh)

        # Architectural floor dividing band (Cornice / Trim slab)
        slab_poly = footprint_poly.buffer(0.08)
        if not slab_poly.is_empty:
            if isinstance(slab_poly, MultiPolygon):
                slab_poly = max(slab_poly.geoms, key=lambda g: g.area)
            slab_mesh = trimesh.creation.extrude_polygon(slab_poly, height=0.18)
            slab_mesh.apply_translation([0, 0, z_start + floor_h - 0.09])
            _set_mesh_color(slab_mesh, secondary_rgba)
            meshes.append(slab_mesh)

        # Windows & Entrances on Front Facade (at y = front_y)
        if f == 0:
            # Ground Floor: Main Teak Entrance Door + Picture Windows
            # Door
            door_x = minx + b_width * 0.25
            door = trimesh.creation.box(extents=[1.2, 0.15, 2.4])
            door.apply_translation([door_x, front_y - 0.06, 1.2])
            _set_mesh_color(door, door_rgba)
            meshes.append(door)

            # Drawing room large picture window
            win_w = min(b_width * 0.45, 3.2)
            win_h = 2.0
            win_x = maxx - win_w * 0.5 - 0.6
            # Frame
            win_frame = trimesh.creation.box(extents=[win_w + 0.12, 0.18, win_h + 0.12])
            win_frame.apply_translation([win_x, front_y - 0.06, 0.5 + win_h * 0.5])
            _set_mesh_color(win_frame, secondary_rgba)
            meshes.append(win_frame)

            # Glass
            win_glass = trimesh.creation.box(extents=[win_w, 0.12, win_h])
            win_glass.apply_translation([win_x, front_y - 0.08, 0.5 + win_h * 0.5])
            _set_mesh_color(win_glass, glass_rgba)
            meshes.append(win_glass)
        else:
            # Upper Floor: Bedroom Windows with horizontal louver bands
            n_windows = max(2, min(4, int(b_width / 3.0)))
            w_w = min(1.8, (b_width * 0.6) / n_windows)
            w_h = 1.7
            spacing = b_width / (n_windows + 1)
            for wi in range(n_windows):
                wx = minx + spacing * (wi + 1)
                w_frame = trimesh.creation.box(extents=[w_w + 0.12, 0.16, w_h + 0.12])
                w_frame.apply_translation([wx, front_y - 0.05, z_start + 0.6 + w_h * 0.5])
                _set_mesh_color(w_frame, secondary_rgba)
                meshes.append(w_frame)

                w_glass = trimesh.creation.box(extents=[w_w, 0.12, w_h])
                w_glass.apply_translation([wx, front_y - 0.07, z_start + 0.6 + w_h * 0.5])
                _set_mesh_color(w_glass, glass_rgba)
                meshes.append(w_glass)

    # ----------------------------------------------------
    # 4. Covered Car Porch (Carport Portico)
    # ----------------------------------------------------
    cars = spec.parking.cars if spec.parking else 1
    porch_w = min(b_width * 0.55, 3.8 if cars == 1 else 5.4)
    porch_d = min(max(front_setback_depth * 0.85, 3.2), 4.8)
    porch_x = minx + porch_w * 0.5 + 0.2
    porch_h = floor_h

    # Porch Roof Slab
    porch_slab = trimesh.creation.box(extents=[porch_w, porch_d, 0.22])
    porch_slab.apply_translation([porch_x, front_y - porch_d * 0.5, porch_h])
    _set_mesh_color(porch_slab, secondary_rgba)
    meshes.append(porch_slab)

    # Porch Structural Pillars (Front corners)
    pillar1 = trimesh.creation.box(extents=[0.38, 0.38, porch_h])
    pillar1.apply_translation([porch_x - porch_w * 0.5 + 0.22, front_y - porch_d + 0.22, porch_h * 0.5])
    _set_mesh_color(pillar1, secondary_rgba)
    meshes.append(pillar1)

    pillar2 = trimesh.creation.box(extents=[0.38, 0.38, porch_h])
    pillar2.apply_translation([porch_x + porch_w * 0.5 - 0.22, front_y - porch_d + 0.22, porch_h * 0.5])
    _set_mesh_color(pillar2, secondary_rgba)
    meshes.append(pillar2)

    # ----------------------------------------------------
    # 5. Balcony on Upper Floor (Walk-out over Porch or Cantilever)
    # ----------------------------------------------------
    if floors >= 2 and (spec.facade.hasBalcony if spec.facade else True):
        balcony_w = porch_w - 0.4
        balcony_d = 1.4
        balcony_z = floor_h

        # Balcony floor slab
        b_slab = trimesh.creation.box(extents=[balcony_w, balcony_d, 0.15])
        b_slab.apply_translation([porch_x, front_y - balcony_d * 0.5, balcony_z + 0.15])
        _set_mesh_color(b_slab, trim_rgba)
        meshes.append(b_slab)

        # Frameless tempered glass balustrade with stainless steel cap
        glass_railing = trimesh.creation.box(extents=[balcony_w, 0.06, 0.9])
        glass_railing.apply_translation([porch_x, front_y - balcony_d + 0.03, balcony_z + 0.2 + 0.45])
        _set_mesh_color(glass_railing, [140, 195, 230, 160])
        meshes.append(glass_railing)

        # Handrail top cap
        handrail = trimesh.creation.box(extents=[balcony_w, 0.1, 0.06])
        handrail.apply_translation([porch_x, front_y - balcony_d + 0.03, balcony_z + 0.2 + 0.9])
        _set_mesh_color(handrail, secondary_rgba)
        meshes.append(handrail)

    # ----------------------------------------------------
    # 6. Traditional Pakistani Jali Screen Feature Wall
    # ----------------------------------------------------
    if spec.facade and spec.facade.hasJali:
        jali_w = min(1.4, b_width * 0.25)
        jali_h = floor_h * 0.85
        jali_z = (floors - 1) * floor_h + 0.4
        jali_x = maxx - jali_w * 0.5 - 0.4
        jali_box = trimesh.creation.box(extents=[jali_w, 0.14, jali_h])
        jali_box.apply_translation([jali_x, front_y - 0.08, jali_z + jali_h * 0.5])
        _set_mesh_color(jali_box, accent_rgba)
        meshes.append(jali_box)

    # ----------------------------------------------------
    # 7. Roof Level: Parapet, Mumty (Stair Tower), Water Tank, Pergola
    # ----------------------------------------------------
    roof_z = floors * floor_h

    # Main roof slab
    roof_mesh = trimesh.creation.extrude_polygon(footprint_poly, height=0.22)
    roof_mesh.apply_translation([0, 0, roof_z])
    _set_mesh_color(roof_mesh, roof_rgba)
    meshes.append(roof_mesh)

    # Parapet wall
    parapet_h = 1.0 if spec.rooftopTerrace else 0.8
    inner_poly = footprint_poly.buffer(-0.25)
    if not inner_poly.is_empty and inner_poly.area > 2.0:
        parapet_poly = footprint_poly.difference(inner_poly)
        if isinstance(parapet_poly, MultiPolygon):
            parapet_poly = max(parapet_poly.geoms, key=lambda g: g.area)
        parapet_mesh = trimesh.creation.extrude_polygon(parapet_poly, height=parapet_h)
        parapet_mesh.apply_translation([0, 0, roof_z + 0.22])
        _set_mesh_color(parapet_mesh, primary_rgba)
        meshes.append(parapet_mesh)

    # Mumty (Staircase Tower) — Real-world Pakistani concrete rooftop stair enclosure
    mumty_w = 3.2
    mumty_d = 3.0
    mumty_h = 2.6
    mumty_x = minx + mumty_w * 0.5 + 0.3
    mumty_y = maxy - mumty_d * 0.5 - 0.3

    mumty_box = trimesh.creation.box(extents=[mumty_w, mumty_d, mumty_h])
    mumty_box.apply_translation([mumty_x, mumty_y, roof_z + 0.22 + mumty_h * 0.5])
    _set_mesh_color(mumty_box, primary_rgba)
    meshes.append(mumty_box)

    # Mumty roof slab
    mumty_slab = trimesh.creation.box(extents=[mumty_w + 0.3, mumty_d + 0.3, 0.16])
    mumty_slab.apply_translation([mumty_x, mumty_y, roof_z + 0.22 + mumty_h + 0.08])
    _set_mesh_color(mumty_slab, secondary_rgba)
    meshes.append(mumty_slab)

    # Overhead Water Tank (Integrated on top of the Mumty Tower)
    if spec.waterTank:
        tank_w, tank_l, tank_h = 1.8, 2.0, 1.4
        tank_box = trimesh.creation.box(extents=[tank_w, tank_l, tank_h])
        tank_box.apply_translation([mumty_x, mumty_y, roof_z + 0.22 + mumty_h + 0.16 + tank_h * 0.5])
        _set_mesh_color(tank_box, tank_rgba)
        meshes.append(tank_box)

    # Rooftop Pergola (if terrace enabled)
    if spec.rooftopPergola and spec.rooftopTerrace:
        perg_w = min(b_width * 0.45, 4.0)
        perg_d = min(b_depth * 0.35, 3.8)
        perg_x = maxx - perg_w * 0.5 - 0.5
        perg_y = front_y + perg_d * 0.5 + 0.5
        perg_h = 2.4

        # 4 Pergola Posts
        for px in [-perg_w * 0.5, perg_w * 0.5]:
            for py in [-perg_d * 0.5, perg_d * 0.5]:
                post = trimesh.creation.box(extents=[0.14, 0.14, perg_h])
                post.apply_translation([perg_x + px, perg_y + py, roof_z + 0.22 + perg_h * 0.5])
                _set_mesh_color(post, secondary_rgba)
                meshes.append(post)

        # Pergola Top Louver Beams
        for bi in range(6):
            beam = trimesh.creation.box(extents=[perg_w + 0.4, 0.1, 0.14])
            by = perg_y - perg_d * 0.5 + bi * (perg_d / 5.0)
            beam.apply_translation([perg_x, by, roof_z + 0.22 + perg_h + 0.07])
            _set_mesh_color(beam, accent_rgba)
            meshes.append(beam)

    # Mughal Dome Accent (if style requested)
    if style_key == "mughal_inspired":
        dome = trimesh.creation.icosphere(subdivisions=2, radius=1.3)
        dome.apply_scale([1.0, 1.0, 1.35])
        dome.apply_translation([mumty_x, mumty_y, roof_z + 0.22 + mumty_h + 0.16 + 1.2])
        _set_mesh_color(dome, trim_rgba)
        meshes.append(dome)

    # ----------------------------------------------------
    # 8. Boundary Wall & Main Motorized Gate (Rule 11)
    # ----------------------------------------------------
    if spec.boundaryWall and plot_poly:
        plot_w = pmaxx - pminx
        plot_d = pmaxy - pminy

        # Inner buffer for wall thickness
        inner_plot = plot_poly.buffer(-0.24)
        if not inner_plot.is_empty and inner_plot.area > 5.0:
            wall_poly = plot_poly.difference(inner_plot)
            if isinstance(wall_poly, MultiPolygon):
                wall_poly = max(wall_poly.geoms, key=lambda g: g.area)

            wall_mesh = trimesh.creation.extrude_polygon(wall_poly, height=2.1)
            _set_mesh_color(wall_mesh, [200, 195, 185, 255])
            meshes.append(wall_mesh)

            # Main Motorized Driveway Gate (facing the street at y = pminy)
            gate_w = min(4.6, plot_w * 0.45)
            gate_x = porch_x  # aligned with car porch
            gate_h = 1.9

            # Gate Pillars (left & right)
            gp1 = trimesh.creation.box(extents=[0.55, 0.55, 2.4])
            gp1.apply_translation([gate_x - gate_w * 0.5 - 0.27, pminy, 1.2])
            _set_mesh_color(gp1, secondary_rgba)
            meshes.append(gp1)

            gp2 = trimesh.creation.box(extents=[0.55, 0.55, 2.4])
            gp2.apply_translation([gate_x + gate_w * 0.5 + 0.27, pminy, 1.2])
            _set_mesh_color(gp2, secondary_rgba)
            meshes.append(gp2)

            # Modern Sliding Gate Frame (dark charcoal)
            gate_frame = trimesh.creation.box(extents=[gate_w, 0.1, gate_h])
            gate_frame.apply_translation([gate_x, pminy, 0.1 + gate_h * 0.5])
            _set_mesh_color(gate_frame, [25, 30, 38, 255])
            meshes.append(gate_frame)

            # Horizontal Teak Wood Infill Slats
            for si in range(6):
                slat = trimesh.creation.box(extents=[gate_w - 0.2, 0.12, 0.14])
                slat_z = 0.25 + si * 0.28
                slat.apply_translation([gate_x, pminy, slat_z])
                _set_mesh_color(slat, accent_rgba)
                meshes.append(slat)

    # ----------------------------------------------------
    # 9. Combine into Scene & Convert Z-Up (Trimesh) to Y-Up (glTF Standard)
    # ----------------------------------------------------
    scene = trimesh.Scene()
    for idx, m in enumerate(meshes):
        scene.add_geometry(m, node_name=f"part_{idx}")

    # CRITICAL: Transform from Trimesh coordinate system (Z-Up) to glTF 2.0 specification (Y-Up):
    #   glTF X = Trimesh X (Width)
    #   glTF Y = Trimesh Z (Height! Mapped to UP in Cesium)
    #   glTF Z = -Trimesh Y (Depth! Mapped to North in Cesium)
    axis_rotation_matrix = trimesh.transformations.rotation_matrix(np.radians(-90), [1, 0, 0])
    scene.apply_transform(axis_rotation_matrix)

    # Export to GLB format (Rule 12)
    glb_data = scene.export(file_type="glb")
    if isinstance(glb_data, str):
        glb_bytes = glb_data.encode("utf-8")
    else:
        glb_bytes = bytes(glb_data)

    total_height = round(floors * floor_h + mumty_h, 1)
    metadata = {
        "footprint_sqm": round(float(footprint_poly.area), 1),
        "total_height_m": total_height,
        "floors": floors,
        "has_basement": has_basement,
        "facade_style": style_key,
        "mesh_count": len(meshes),
        "glb_size_bytes": len(glb_bytes),
    }

    return glb_bytes, metadata
