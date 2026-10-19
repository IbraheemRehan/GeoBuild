"""
GeoBuild AI — Procedural 3D Generator
Generates photorealistic, professional procedural 3D GLB building models.
Rule 11: Procedural geometry only — no AI-generated meshes.
Rule 12: All 3D output is GLB format.
Rule 13: Use trimesh for extrusion.
Rule 14: Facade styles come from data/styles/*.json, never hardcoded.
Rule 7: All internal measurements are in metres.
"""

from __future__ import annotations
import io
import json
import math
import os
from typing import Any
import numpy as np
from shapely.geometry import Polygon, MultiPolygon
import trimesh
from trimesh.visual.material import PBRMaterial

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
            "colors": {
                "primary": "#EAE4DC",
                "secondary": "#262930",
                "accent": "#7A4726",
                "trim": "#CBD5E1",
                "glass": "#4A6E82",
                "mullion": "#181A20",
            },
        }
    }


def _hex_to_rgb_float(hex_code: str) -> tuple[float, float, float]:
    """Convert hex string (e.g. #D4B896) to (R, G, B) normalized floats 0.0-1.0."""
    hex_clean = hex_code.lstrip("#")
    if len(hex_clean) == 6:
        r = int(hex_clean[0:2], 16) / 255.0
        g = int(hex_clean[2:4], 16) / 255.0
        b = int(hex_clean[4:6], 16) / 255.0
        return r, g, b
    return 0.9, 0.88, 0.85


def _create_pbr_material(
    name: str,
    hex_color: str,
    roughness: float = 0.75,
    metallic: float = 0.0,
    alpha: float = 1.0,
    alpha_mode: str = "OPAQUE",
    emissive_hex: str | None = None,
) -> PBRMaterial:
    """Create a physically based rendering (PBR) glTF material."""
    r, g, b = _hex_to_rgb_float(hex_color)
    kwargs: dict[str, Any] = {
        "name": name,
        "baseColorFactor": [r, g, b, alpha],
        "roughnessFactor": roughness,
        "metallicFactor": metallic,
        "alphaMode": alpha_mode,
    }
    if emissive_hex:
        er, eg, eb = _hex_to_rgb_float(emissive_hex)
        kwargs["emissiveFactor"] = [er, eg, eb]
    return PBRMaterial(**kwargs)


def _apply_material(mesh: trimesh.Trimesh, material: PBRMaterial) -> trimesh.Trimesh:
    """Assign a PBR material to a mesh visual."""
    mesh.visual.material = material
    return mesh


def generate_building_glb(
    footprint_poly: Polygon,
    spec: BuildingSpec,
    plot_poly: Polygon | None = None,
) -> tuple[bytes, dict[str, Any]]:
    """
    Generate a photorealistic procedural 3D GLB building model in canonical coordinates.
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
        "primary": "#EAE4DC",
        "secondary": "#262930",
        "accent": "#7A4726",
        "trim": "#CBD5E1",
        "glass": "#4A6E82",
        "mullion": "#181A20",
    })

    # ----------------------------------------------------
    # Professional PBR Materials Library
    # ----------------------------------------------------
    mat_plaster = _create_pbr_material(
        "Mat_Plaster_Facade",
        colors.get("primary", "#EFE9E1"),
        roughness=0.72,
        metallic=0.01,
    )
    mat_stone_accent = _create_pbr_material(
        "Mat_Charcoal_Granite",
        colors.get("secondary", "#202328"),
        roughness=0.32,
        metallic=0.12,
    )
    mat_wood_teak = _create_pbr_material(
        "Mat_Burmese_Teak",
        colors.get("accent", "#8B4E26"),
        roughness=0.30,
        metallic=0.05,
    )
    mat_trim = _create_pbr_material(
        "Mat_Architectural_Trim",
        colors.get("trim", "#CBD5E1"),
        roughness=0.40,
        metallic=0.14,
    )
    mat_glass = _create_pbr_material(
        "Mat_Reflective_Solar_Glass",
        colors.get("glass", "#27475C"),
        roughness=0.02,
        metallic=0.40,
        alpha=0.50,
        alpha_mode="BLEND",
    )
    mat_mullion = _create_pbr_material(
        "Mat_Anodized_Black_Aluminum",
        colors.get("mullion", "#111215"),
        roughness=0.20,
        metallic=0.88,
    )
    mat_steel = _create_pbr_material(
        "Mat_Stainless_Steel",
        "#E2E8F0",
        roughness=0.12,
        metallic=0.96,
    )
    mat_pavers = _create_pbr_material(
        "Mat_Driveway_Pavers",
        "#26282D",
        roughness=0.85,
        metallic=0.02,
    )
    mat_lawn = _create_pbr_material(
        "Mat_Lawn_Grass",
        "#28541B",
        roughness=0.95,
        metallic=0.0,
    )
    mat_plinth = _create_pbr_material(
        "Mat_Granite_Plinth",
        "#474D58",
        roughness=0.65,
        metallic=0.08,
    )
    mat_roof = _create_pbr_material(
        "Mat_Roof_Terrace_Pavers",
        "#2F3540",
        roughness=0.85,
        metallic=0.03,
    )
    mat_tank_enclosure = _create_pbr_material(
        "Mat_Tank_Architectural_Screen",
        "#24272D",
        roughness=0.35,
        metallic=0.15,
    )
    mat_door = _create_pbr_material(
        "Mat_Entry_Pivot_Door",
        "#422312",
        roughness=0.25,
        metallic=0.06,
    )
    mat_planter_green = _create_pbr_material(
        "Mat_Boxwood_Planter",
        "#1B4012",
        roughness=0.95,
        metallic=0.0,
    )
    mat_led_warm = _create_pbr_material(
        "Mat_LED_Accent_Light",
        "#FFFDF5",
        roughness=0.1,
        metallic=0.0,
        emissive_hex="#FDE68A",
    )

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
        pminx, pminy, pmaxx, pmaxy = minx - 0.3, miny - 2.5, maxx + 0.3, maxy + 1.5

    front_setback_depth = max(front_y - pminy, 0.8)

    # ----------------------------------------------------
    # 1. Architectural Plinth Foundation (Elevated Ground Plane)
    # ----------------------------------------------------
    plinth_h = 0.35
    plinth_poly = footprint_poly.buffer(0.06)
    if not plinth_poly.is_empty:
        if isinstance(plinth_poly, MultiPolygon):
            plinth_poly = max(plinth_poly.geoms, key=lambda g: g.area)
        plinth_mesh = trimesh.creation.extrude_polygon(plinth_poly, height=plinth_h)
        plinth_mesh.apply_translation([0, 0, 0])
        _apply_material(plinth_mesh, mat_plinth)
        meshes.append(plinth_mesh)

    # ----------------------------------------------------
    # 2. Paved Driveway & Manicured Lawn (Strictly Inside Setback)
    # ----------------------------------------------------
    if front_setback_depth > 0.8:
        driveway_w = min(b_width * 0.52, 4.8)
        driveway_d = max(front_setback_depth - 0.25, 0.5)
        driveway_x = minx + driveway_w * 0.5 + 0.12
        driveway_y = pminy + 0.12 + driveway_d * 0.5
        driveway_mesh = trimesh.creation.box(extents=[driveway_w, driveway_d, 0.06])
        driveway_mesh.apply_translation([driveway_x, driveway_y, 0.03])
        _apply_material(driveway_mesh, mat_pavers)
        meshes.append(driveway_mesh)

        # Manicured green lawn garden on the opposite side
        lawn_w = min(b_width - driveway_w - 0.4, 4.5)
        if lawn_w > 1.0:
            lawn_x = maxx - lawn_w * 0.5 - 0.12
            lawn_mesh = trimesh.creation.box(extents=[lawn_w, driveway_d, 0.05])
            lawn_mesh.apply_translation([lawn_x, driveway_y, 0.025])
            _apply_material(lawn_mesh, mat_lawn)
            meshes.append(lawn_mesh)

    # ----------------------------------------------------
    # 3. Underground Basement (if configured)
    # ----------------------------------------------------
    if has_basement:
        base_mesh = trimesh.creation.extrude_polygon(footprint_poly, height=floor_h)
        base_mesh.apply_translation([0, 0, -floor_h])
        _apply_material(base_mesh, mat_stone_accent)
        meshes.append(base_mesh)

    # ----------------------------------------------------
    # 4. Vertical Architectural Accent Cladding Pier (Double-Height Feature)
    # ----------------------------------------------------
    pier_w = min(1.3, b_width * 0.18)
    pier_d = 0.35
    pier_h = floors * floor_h + 0.6
    pier_x = maxx - pier_w * 0.5 - 0.35
    pier_box = trimesh.creation.box(extents=[pier_w, pier_d, pier_h])
    pier_box.apply_translation([pier_x, front_y - pier_d * 0.5 + 0.08, plinth_h + pier_h * 0.5])
    _apply_material(pier_box, mat_stone_accent)
    meshes.append(pier_box)

    # Horizontal architectural shadow reveal grooves on the pier
    n_grooves = int(floors * 3)
    for gi in range(n_grooves):
        groove = trimesh.creation.box(extents=[pier_w + 0.02, 0.04, 0.04])
        gz = plinth_h + 0.8 + gi * 0.95
        groove.apply_translation([pier_x, front_y - pier_d + 0.06, gz])
        _apply_material(groove, mat_mullion)
        meshes.append(groove)

    # ----------------------------------------------------
    # 5. Above-Ground Storeys & Architectural Massing
    # ----------------------------------------------------
    for f in range(floors):
        z_start = plinth_h + f * floor_h

        # Main Floor Body Extrusion
        floor_mesh = trimesh.creation.extrude_polygon(footprint_poly, height=floor_h)
        floor_mesh.apply_translation([0, 0, z_start])
        _apply_material(floor_mesh, mat_plaster)
        meshes.append(floor_mesh)

        # Architectural Horizontal Floor Dividing Slab (Inter-floor Belt Course)
        slab_poly = footprint_poly.buffer(0.08)
        if not slab_poly.is_empty:
            if isinstance(slab_poly, MultiPolygon):
                slab_poly = max(slab_poly.geoms, key=lambda g: g.area)
            slab_mesh = trimesh.creation.extrude_polygon(slab_poly, height=0.18)
            slab_mesh.apply_translation([0, 0, z_start + floor_h - 0.09])
            _apply_material(slab_mesh, mat_trim)
            meshes.append(slab_mesh)

        # === Windows on Left & Right Side Walls (Full 360° Realism) ===
        if b_depth > 5.0:
            for side_idx, wall_x in enumerate([minx, maxx]):
                n_side_win = 2 if b_depth > 9.0 else 1
                for wi in range(n_side_win):
                    wy = miny + b_depth * (0.35 + wi * 0.35)
                    sw_w = 0.16
                    sw_d = min(1.4, b_depth * 0.22)
                    sw_h = min(1.6, floor_h * 0.55)
                    sw_z = z_start + 0.9 + sw_h * 0.5

                    # Black frame
                    sw_frame = trimesh.creation.box(extents=[sw_w, sw_d + 0.12, sw_h + 0.12])
                    sw_frame.apply_translation([wall_x, wy, sw_z])
                    _apply_material(sw_frame, mat_mullion)
                    meshes.append(sw_frame)

                    # Reflective glass pane
                    sw_glass = trimesh.creation.box(extents=[0.06, sw_d, sw_h])
                    sw_glass.apply_translation([wall_x, wy, sw_z])
                    _apply_material(sw_glass, mat_glass)
                    meshes.append(sw_glass)

                    # Projecting architectural sill
                    sw_sill = trimesh.creation.box(extents=[sw_w + 0.08, sw_d + 0.2, 0.07])
                    sw_sill.apply_translation([wall_x, wy, z_start + 0.9 - 0.04])
                    _apply_material(sw_sill, mat_trim)
                    meshes.append(sw_sill)

        # === Rear Wall Windows / Patio Doors ===
        if b_width > 4.5:
            rear_y = maxy
            if f == 0:
                # Ground floor rear 4-panel sliding glass door onto garden
                rw_w = min(3.0, b_width * 0.45)
                rw_h = min(2.3, floor_h * 0.75)
                rw_z = z_start + rw_h * 0.5
                rw_x = minx + b_width * 0.5

                r_frame = trimesh.creation.box(extents=[rw_w + 0.12, 0.16, rw_h + 0.12])
                r_frame.apply_translation([rw_x, rear_y, rw_z])
                _apply_material(r_frame, mat_mullion)
                meshes.append(r_frame)

                r_glass = trimesh.creation.box(extents=[rw_w, 0.06, rw_h])
                r_glass.apply_translation([rw_x, rear_y, rw_z])
                _apply_material(r_glass, mat_glass)
                meshes.append(r_glass)
            else:
                # Upper floor rear bedroom window
                rw_w = min(2.2, b_width * 0.35)
                rw_h = min(1.6, floor_h * 0.55)
                rw_z = z_start + 0.9 + rw_h * 0.5
                rw_x = minx + b_width * 0.5

                r_frame = trimesh.creation.box(extents=[rw_w + 0.12, 0.16, rw_h + 0.12])
                r_frame.apply_translation([rw_x, rear_y, rw_z])
                _apply_material(r_frame, mat_mullion)
                meshes.append(r_frame)

                r_glass = trimesh.creation.box(extents=[rw_w, 0.06, rw_h])
                r_glass.apply_translation([rw_x, rear_y, rw_z])
                _apply_material(r_glass, mat_glass)
                meshes.append(r_glass)

        # === Storey-Specific Facade Architectural Features ===
        if f == 0:
            # Entrance Stepped Landing (Confined inside setback)
            door_w = 1.3
            door_h = 2.7
            door_x = minx + b_width * 0.35
            step_d = min(0.65, max(front_setback_depth * 0.35, 0.3))
            step_box = trimesh.creation.box(extents=[door_w + 0.6, step_d, 0.18])
            step_box.apply_translation([door_x, front_y - step_d * 0.5, plinth_h])
            _apply_material(step_box, mat_plinth)
            meshes.append(step_box)

            # Modern Entryway Planter Box with Lush Greenery
            planter_w = door_w + 0.6
            planter_d = 0.35
            planter_h = 0.45
            planter_box = trimesh.creation.box(extents=[planter_w, planter_d, planter_h])
            planter_box.apply_translation([door_x, front_y - step_d - planter_d * 0.5, plinth_h + planter_h * 0.5])
            _apply_material(planter_box, mat_stone_accent)
            meshes.append(planter_box)

            shrub = trimesh.creation.box(extents=[planter_w - 0.08, planter_d - 0.08, 0.35])
            shrub.apply_translation([door_x, front_y - step_d - planter_d * 0.5, plinth_h + planter_h + 0.175])
            _apply_material(shrub, mat_planter_green)
            meshes.append(shrub)

            # Grand Entrance Pivot Door (Natural Teak Wood)
            door_mesh = trimesh.creation.box(extents=[door_w, 0.12, door_h])
            door_mesh.apply_translation([door_x, front_y - 0.06, plinth_h + door_h * 0.5])
            _apply_material(door_mesh, mat_door)
            meshes.append(door_mesh)

            # Stainless Steel Long Vertical Pull Handle
            handle = trimesh.creation.box(extents=[0.04, 0.08, 1.4])
            handle.apply_translation([door_x - door_w * 0.35, front_y - 0.14, plinth_h + 1.2])
            _apply_material(handle, mat_steel)
            meshes.append(handle)

            # Floor-to-Ceiling Drawing Room Curtain Wall (Panoramic Glass)
            glass_w = min(b_width * 0.42, 4.2)
            glass_h = floor_h * 0.82
            glass_x = maxx - glass_w * 0.5 - 0.8
            glass_z = plinth_h + 0.3 + glass_h * 0.5

            # Recessed Window Frame Reveal (Matte Black Aluminum)
            frame_box = trimesh.creation.box(extents=[glass_w + 0.16, 0.22, glass_h + 0.16])
            frame_box.apply_translation([glass_x, front_y - 0.08, glass_z])
            _apply_material(frame_box, mat_mullion)
            meshes.append(frame_box)

            # Reflective Tinted Curtain Glass Pane
            glass_pane = trimesh.creation.box(extents=[glass_w, 0.08, glass_h])
            glass_pane.apply_translation([glass_x, front_y - 0.12, glass_z])
            _apply_material(glass_pane, mat_glass)
            meshes.append(glass_pane)

            # Vertical Aluminum Mullion Dividers
            n_div = 3
            for di in range(1, n_div):
                mx = glass_x - glass_w * 0.5 + di * (glass_w / n_div)
                mullion = trimesh.creation.box(extents=[0.06, 0.16, glass_h])
                mullion.apply_translation([mx, front_y - 0.12, glass_z])
                _apply_material(mullion, mat_mullion)
                meshes.append(mullion)

        elif f == 1:
            # === First Floor Cantilevered Master Suite & Balcony ===
            canti_w = min(b_width * 0.48, 4.6)
            canti_d = min(0.6, max(front_setback_depth * 0.35, 0.3))
            canti_x = maxx - canti_w * 0.5 - 0.4
            canti_y = front_y - canti_d * 0.5
            canti_z = z_start + floor_h * 0.5

            canti_box = trimesh.creation.box(extents=[canti_w, canti_d, floor_h])
            canti_box.apply_translation([canti_x, canti_y, canti_z])
            _apply_material(canti_box, mat_plaster)
            meshes.append(canti_box)

            # Cantilever Base Underside Trim with Warm LED Accent Channel
            canti_trim = trimesh.creation.box(extents=[canti_w + 0.1, canti_d + 0.05, 0.12])
            canti_trim.apply_translation([canti_x, canti_y, z_start + 0.06])
            _apply_material(canti_trim, mat_stone_accent)
            meshes.append(canti_trim)

            canti_led = trimesh.creation.box(extents=[canti_w - 0.4, 0.04, 0.04])
            canti_led.apply_translation([canti_x, front_y - canti_d + 0.05, z_start])
            _apply_material(canti_led, mat_led_warm)
            meshes.append(canti_led)

            # Upper Master Bedroom Ribbon Window
            m_win_w = canti_w * 0.75
            m_win_h = 1.9
            m_win_x = canti_x
            m_win_z = z_start + 0.5 + m_win_h * 0.5

            m_win_frame = trimesh.creation.box(extents=[m_win_w + 0.12, 0.16, m_win_h + 0.12])
            m_win_frame.apply_translation([m_win_x, front_y - canti_d - 0.04, m_win_z])
            _apply_material(m_win_frame, mat_mullion)
            meshes.append(m_win_frame)

            m_win_glass = trimesh.creation.box(extents=[m_win_w, 0.08, m_win_h])
            m_win_glass.apply_translation([m_win_x, front_y - canti_d - 0.08, m_win_z])
            _apply_material(m_win_glass, mat_glass)
            meshes.append(m_win_glass)

            # Architectural Horizontal Wood Louvers (Brise-Soleil)
            for li in range(4):
                louver = trimesh.creation.box(extents=[m_win_w + 0.2, 0.12, 0.07])
                lz = z_start + 0.7 + li * 0.42
                louver.apply_translation([m_win_x, front_y - canti_d - 0.14, lz])
                _apply_material(louver, mat_wood_teak)
                meshes.append(louver)

    # ----------------------------------------------------
    # 6. Covered Carport / Car Porch (Luxury Canopy Confined to Setback)
    # ----------------------------------------------------
    cars = spec.parking.cars if spec.parking else 1
    porch_w = min(b_width * 0.48, 3.8 if cars <= 1 else 5.2)
    max_porch_d = max(front_setback_depth - 0.35, 1.2)
    porch_d = min(max_porch_d, 4.2)
    porch_x = minx + porch_w * 0.5 + 0.2
    porch_h = floor_h + plinth_h

    # Porch Roof Cantilevered Slab (Concrete with fascia trim)
    porch_slab = trimesh.creation.box(extents=[porch_w, porch_d, 0.24])
    porch_slab.apply_translation([porch_x, front_y - porch_d * 0.5, porch_h])
    _apply_material(porch_slab, mat_stone_accent)
    meshes.append(porch_slab)

    # Warm LED Downlight Strips in Porch Soffit
    porch_led = trimesh.creation.box(extents=[porch_w * 0.6, 0.08, 0.04])
    porch_led.apply_translation([porch_x, front_y - porch_d * 0.5, porch_h - 0.13])
    _apply_material(porch_led, mat_led_warm)
    meshes.append(porch_led)

    # Twin Composite Structural Pillars (Inside plot)
    p_size = 0.38
    p1 = trimesh.creation.box(extents=[p_size, p_size, porch_h])
    p1.apply_translation([porch_x - porch_w * 0.5 + p_size * 0.6, front_y - porch_d + p_size * 0.6, porch_h * 0.5])
    _apply_material(p1, mat_stone_accent)
    meshes.append(p1)

    p2 = trimesh.creation.box(extents=[p_size, p_size, porch_h])
    p2.apply_translation([porch_x + porch_w * 0.5 - p_size * 0.6, front_y - porch_d + p_size * 0.6, porch_h * 0.5])
    _apply_material(p2, mat_stone_accent)
    meshes.append(p2)

    # ----------------------------------------------------
    # 7. Walk-Out Balcony Terrace (Over Porch Slab)
    # ----------------------------------------------------
    if floors >= 2 and (spec.facade.hasBalcony if spec.facade else True):
        balcony_w = porch_w - 0.3
        balcony_d = min(porch_d * 0.65, 1.8)
        balcony_z = porch_h + 0.13

        # Balcony Floor Finish
        b_floor = trimesh.creation.box(extents=[balcony_w, balcony_d, 0.08])
        b_floor.apply_translation([porch_x, front_y - balcony_d * 0.5, balcony_z + 0.04])
        _apply_material(b_floor, mat_pavers)
        meshes.append(b_floor)

        # Frameless Tempered Glass Balustrade (PBR Transparency)
        glass_balustrade = trimesh.creation.box(extents=[balcony_w, 0.05, 0.95])
        glass_balustrade.apply_translation([porch_x, front_y - balcony_d + 0.03, balcony_z + 0.55])
        _apply_material(glass_balustrade, mat_glass)
        meshes.append(glass_balustrade)

        # Side Glass Balustrade
        side_glass = trimesh.creation.box(extents=[0.05, balcony_d, 0.95])
        side_glass.apply_translation([porch_x - balcony_w * 0.5 + 0.03, front_y - balcony_d * 0.5, balcony_z + 0.55])
        _apply_material(side_glass, mat_glass)
        meshes.append(side_glass)

        # Stainless Steel Handrail Cap
        rail_cap = trimesh.creation.box(extents=[balcony_w + 0.06, 0.09, 0.05])
        rail_cap.apply_translation([porch_x, front_y - balcony_d + 0.03, balcony_z + 1.05])
        _apply_material(rail_cap, mat_steel)
        meshes.append(rail_cap)

        # First Floor Sliding Glass Access Door onto Balcony
        door_glass = trimesh.creation.box(extents=[1.8, 0.1, 2.2])
        door_glass.apply_translation([porch_x, front_y - 0.05, balcony_z + 1.1])
        _apply_material(door_glass, mat_glass)
        meshes.append(door_glass)

    # ----------------------------------------------------
    # 8. Traditional Geometric Jali Screen Accent
    # ----------------------------------------------------
    if spec.facade and spec.facade.hasJali:
        jali_w = min(1.6, b_width * 0.28)
        jali_h = floor_h * 0.9
        jali_z = plinth_h + (floors - 1) * floor_h + 0.35 + jali_h * 0.5
        jali_x = minx + jali_w * 0.5 + 0.25
        jali_box = trimesh.creation.box(extents=[jali_w, 0.12, jali_h])
        jali_box.apply_translation([jali_x, front_y - 0.08, jali_z])
        _apply_material(jali_box, mat_wood_teak)
        meshes.append(jali_box)

    # ----------------------------------------------------
    # 9. Roof Level: Parapet, Mumty Tower, Architectural Tank & Pergola
    # ----------------------------------------------------
    roof_z = plinth_h + floors * floor_h

    # Main Roof Slab
    roof_slab = trimesh.creation.extrude_polygon(footprint_poly, height=0.22)
    roof_slab.apply_translation([0, 0, roof_z])
    _apply_material(roof_slab, mat_roof)
    meshes.append(roof_slab)

    # Parapet Wall with Coping Cap
    parapet_h = 1.0 if spec.rooftopTerrace else 0.85
    inner_poly = footprint_poly.buffer(-0.24)
    if not inner_poly.is_empty and inner_poly.area > 2.0:
        parapet_poly = footprint_poly.difference(inner_poly)
        if isinstance(parapet_poly, MultiPolygon):
            parapet_poly = max(parapet_poly.geoms, key=lambda g: g.area)
        parapet_mesh = trimesh.creation.extrude_polygon(parapet_poly, height=parapet_h)
        parapet_mesh.apply_translation([0, 0, roof_z + 0.22])
        _apply_material(parapet_mesh, mat_plaster)
        meshes.append(parapet_mesh)

        # Coping Cap Trim on Top of Parapet
        coping_poly = parapet_poly.buffer(0.04)
        if not coping_poly.is_empty:
            if isinstance(coping_poly, MultiPolygon):
                coping_poly = max(coping_poly.geoms, key=lambda g: g.area)
            coping_mesh = trimesh.creation.extrude_polygon(coping_poly, height=0.08)
            coping_mesh.apply_translation([0, 0, roof_z + 0.22 + parapet_h])
            _apply_material(coping_mesh, mat_trim)
            meshes.append(coping_mesh)

    # Mumty (Staircase Tower) — Real-world Pakistani concrete rooftop stair enclosure
    mumty_w = min(3.4, b_width * 0.45)
    mumty_d = min(3.2, b_depth * 0.35)
    mumty_h = 2.65
    mumty_x = minx + mumty_w * 0.5 + 0.4
    mumty_y = maxy - mumty_d * 0.5 - 0.4

    mumty_box = trimesh.creation.box(extents=[mumty_w, mumty_d, mumty_h])
    mumty_box.apply_translation([mumty_x, mumty_y, roof_z + 0.22 + mumty_h * 0.5])
    _apply_material(mumty_box, mat_plaster)
    meshes.append(mumty_box)

    # Mumty Horizontal Ribbon Clerestory Window
    m_win = trimesh.creation.box(extents=[mumty_w * 0.6, 0.1, 0.6])
    m_win.apply_translation([mumty_x, mumty_y - mumty_d * 0.5 - 0.05, roof_z + 0.22 + mumty_h * 0.65])
    _apply_material(m_win, mat_glass)
    meshes.append(m_win)

    # Mumty Overhanging Roof Slab
    mumty_slab = trimesh.creation.box(extents=[mumty_w + 0.4, mumty_d + 0.4, 0.16])
    mumty_slab.apply_translation([mumty_x, mumty_y, roof_z + 0.22 + mumty_h + 0.08])
    _apply_material(mumty_slab, mat_stone_accent)
    meshes.append(mumty_slab)

    # Overhead Water Tank — Integrated Architectural Louvered Screen (NO ugly blue plastic!)
    if spec.waterTank:
        tank_w, tank_l, tank_h = min(2.0, mumty_w * 0.8), min(2.2, mumty_d * 0.8), 1.35
        tank_box = trimesh.creation.box(extents=[tank_w, tank_l, tank_h])
        tank_box.apply_translation([mumty_x, mumty_y, roof_z + 0.22 + mumty_h + 0.16 + tank_h * 0.5])
        _apply_material(tank_box, mat_tank_enclosure)
        meshes.append(tank_box)

        # Architectural trim band on tank enclosure
        tank_band = trimesh.creation.box(extents=[tank_w + 0.08, tank_l + 0.08, 0.12])
        tank_band.apply_translation([mumty_x, mumty_y, roof_z + 0.22 + mumty_h + 0.16 + tank_h * 0.5])
        _apply_material(tank_band, mat_trim)
        meshes.append(tank_band)

    # Rooftop Terrace Pergola
    if spec.rooftopPergola and spec.rooftopTerrace:
        perg_w = min(b_width * 0.45, 4.2)
        perg_d = min(b_depth * 0.35, 3.8)
        perg_x = maxx - perg_w * 0.5 - 0.5
        perg_y = front_y + perg_d * 0.5 + 0.6
        perg_h = 2.45

        # 4 Pergola Posts
        for px in [-perg_w * 0.5, perg_w * 0.5]:
            for py in [-perg_d * 0.5, perg_d * 0.5]:
                post = trimesh.creation.box(extents=[0.14, 0.14, perg_h])
                post.apply_translation([perg_x + px, perg_y + py, roof_z + 0.22 + perg_h * 0.5])
                _apply_material(post, mat_stone_accent)
                meshes.append(post)

        # Pergola Top Louver Beams (Natural Teak Wood)
        n_beams = 7
        for bi in range(n_beams):
            beam = trimesh.creation.box(extents=[perg_w + 0.5, 0.1, 0.15])
            by = perg_y - perg_d * 0.5 + bi * (perg_d / (n_beams - 1))
            beam.apply_translation([perg_x, by, roof_z + 0.22 + perg_h + 0.08])
            _apply_material(beam, mat_wood_teak)
            meshes.append(beam)

    # Mughal Dome Accent (if style requested)
    if style_key == "mughal_inspired":
        dome = trimesh.creation.icosphere(subdivisions=3, radius=1.35)
        dome.apply_scale([1.0, 1.0, 1.45])
        dome.apply_translation([mumty_x, mumty_y, roof_z + 0.22 + mumty_h + 0.16 + 1.25])
        _apply_material(dome, mat_stone_accent)
        meshes.append(dome)

        # Gold spire / finial
        spire = trimesh.creation.cylinder(radius=0.08, height=1.2)
        spire.apply_translation([mumty_x, mumty_y, roof_z + 0.22 + mumty_h + 0.16 + 2.5])
        _apply_material(spire, mat_trim)
        meshes.append(spire)

    # ----------------------------------------------------
    # 10. Low Boundary Perimeter Curb & Motorized Entrance Gate (Strictly Inside Plot)
    # ----------------------------------------------------
    if spec.boundaryWall and plot_poly:
        plot_w = pmaxx - pminx
        plot_d = pmaxy - pminy

        outer_plot = plot_poly.buffer(-0.06)
        inner_plot = plot_poly.buffer(-0.24)
        if not inner_plot.is_empty and inner_plot.area > 5.0 and not outer_plot.is_empty:
            wall_poly = outer_plot.difference(inner_plot)
            if isinstance(wall_poly, MultiPolygon):
                wall_poly = max(wall_poly.geoms, key=lambda g: g.area)

            # Elegant low boundary perimeter curb (height 0.55m)
            wall_h = 0.55
            wall_mesh = trimesh.creation.extrude_polygon(wall_poly, height=wall_h)
            _apply_material(wall_mesh, mat_plaster)
            meshes.append(wall_mesh)

            # Boundary Wall Dark Coping Cap (height 0.06m)
            coping_m = trimesh.creation.extrude_polygon(wall_poly, height=0.06)
            coping_m.apply_translation([0, 0, wall_h])
            _apply_material(coping_m, mat_stone_accent)
            meshes.append(coping_m)

            # Main Motorized Driveway Gate (facing street, strictly inside pminy)
            gate_w = min(4.2, plot_w * 0.45)
            gate_x = porch_x
            gate_h = 1.6
            gp_w = 0.42
            gp_d = 0.42
            gp_y = pminy + 0.08 + gp_d * 0.5

            # Gate Pillars (left & right, strictly inside plot boundary)
            gp1 = trimesh.creation.box(extents=[gp_w, gp_d, 1.8])
            gp1.apply_translation([gate_x - gate_w * 0.5 - gp_w * 0.5, gp_y, 0.9])
            _apply_material(gp1, mat_stone_accent)
            meshes.append(gp1)

            gp2 = trimesh.creation.box(extents=[gp_w, gp_d, 1.8])
            gp2.apply_translation([gate_x + gate_w * 0.5 + gp_w * 0.5, gp_y, 0.9])
            _apply_material(gp2, mat_stone_accent)
            meshes.append(gp2)

            # Gate Pillar Top Light Caps
            g_light1 = trimesh.creation.box(extents=[gp_w + 0.06, gp_d + 0.06, 0.08])
            g_light1.apply_translation([gate_x - gate_w * 0.5 - gp_w * 0.5, gp_y, 1.84])
            _apply_material(g_light1, mat_trim)
            meshes.append(g_light1)

            g_light2 = trimesh.creation.box(extents=[gp_w + 0.06, gp_d + 0.06, 0.08])
            g_light2.apply_translation([gate_x + gate_w * 0.5 + gp_w * 0.5, gp_y, 1.84])
            _apply_material(g_light2, mat_trim)
            meshes.append(g_light2)

            # Luxury Sliding Gate Outer Frame (Anodized Dark Steel)
            gate_frame = trimesh.creation.box(extents=[gate_w, 0.08, gate_h])
            gate_frame.apply_translation([gate_x, gp_y, 0.08 + gate_h * 0.5])
            _apply_material(gate_frame, mat_mullion)
            meshes.append(gate_frame)

            # Horizontal Teak Wood Infill Slats
            n_slats = 6
            for si in range(n_slats):
                slat = trimesh.creation.box(extents=[gate_w - 0.16, 0.09, 0.12])
                slat_z = 0.22 + si * 0.24
                slat.apply_translation([gate_x, gp_y, slat_z])
                _apply_material(slat, mat_wood_teak)
                meshes.append(slat)

    # ----------------------------------------------------
    # 11. Combine Scene & Convert to glTF 2.0 Y-Up Standard
    # ----------------------------------------------------
    scene = trimesh.Scene()
    for idx, m in enumerate(meshes):
        scene.add_geometry(m, node_name=f"part_{idx}")

    # Transform from Trimesh coordinate system (Z-Up) to glTF 2.0 specification (Y-Up):
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

    total_height = round(plinth_h + floors * floor_h + mumty_h, 1)
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
