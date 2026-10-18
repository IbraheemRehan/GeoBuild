"""
GeoBuild AI — Procedural Architectural 3D Generator
Generates photorealistic, professional procedural 3D GLB building models with PBR textures.
Rule 11: Procedural geometry only — no AI-generated meshes.
Rule 12: All 3D output is GLB format.
Rule 13: Use trimesh for extrusion.
Rule 14: Facade styles come from data/styles/*.json, never hardcoded.
Rule 7: All internal measurements are in metres.
"""

from __future__ import annotations
import json
import math
import os
from typing import Any
import numpy as np
from shapely.geometry import Polygon, MultiPolygon, box
import shapely.affinity as affinity
import trimesh

from models import BuildingSpec
from geometry.textures import (
    get_material_library,
    create_textured_box,
    create_uv_extruded_polygon,
    create_recessed_window,
    create_architectural_door,
    create_balcony_railing,
    create_cantilevered_pergola,
)

STYLES_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "data", "styles")
)


def load_facade_presets() -> dict[str, Any]:
    """Load facade style presets from data/styles/facade_presets.json (Rule 14)."""
    preset_file = os.path.join(STYLES_DIR, "facade_presets.json")
    if os.path.exists(preset_file):
        try:
            with open(preset_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}


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
    style_key = spec.facade.style if spec.facade and spec.facade.style else "contemporary_pakistani"
    if style_key not in presets and "contemporary_pakistani" in presets:
        style_key = "contemporary_pakistani"

    style_preset = presets.get(style_key, {})
    has_jali = bool(style_preset.get("hasJali", False))
    window_style = style_preset.get("windowStyle", "curtain_wall_mullions")

    # Load unified suite of photorealistic PBR materials with seamless textures
    mats = get_material_library(style_key)

    mat_wall = mats["wall"]
    mat_accent = mats["accent"]
    mat_wood = mats["wood"]
    mat_glass = mats["glass"]
    mat_mullion = mats["mullion"]
    mat_trim = mats["trim"]
    mat_pavers = mats["pavers"]
    mat_roof = mats["roof"]
    mat_lawn = mats["lawn"]
    mat_concrete = mats["concrete"]
    mat_jali = mats["jali"]
    mat_led = mats["led_warm"]

    meshes: list[trimesh.Trimesh] = []

    floor_h = float(spec.floorHeightM) if spec.floorHeightM else 3.20
    floors = max(int(spec.floors), 1)
    has_basement = bool(spec.basement)

    # Footprint bounds
    minx, miny, maxx, maxy = footprint_poly.bounds
    b_width = maxx - minx
    b_depth = maxy - miny
    front_y = miny

    # Plot bounds
    if plot_poly and not plot_poly.is_empty:
        pminx, pminy, pmaxx, pmaxy = plot_poly.bounds
    else:
        pminx, pminy, pmaxx, pmaxy = minx - 0.5, miny - 2.5, maxx + 0.5, maxy + 1.5

    front_setback_depth = max(front_y - pminy, 0.6)

    # ----------------------------------------------------
    # 1. Architectural Plinth Foundation (Elevated Ground Plane)
    # ----------------------------------------------------
    plinth_h = 0.40
    plinth_poly = footprint_poly.buffer(0.04)
    if plot_poly and not plot_poly.is_empty:
        plinth_poly = plinth_poly.intersection(plot_poly.buffer(-0.02))
    if not plinth_poly.is_empty:
        if isinstance(plinth_poly, MultiPolygon):
            plinth_poly = max(plinth_poly.geoms, key=lambda g: g.area)
        plinth_mesh = create_uv_extruded_polygon(
            plinth_poly, height=plinth_h, material=mat_concrete, uv_meter_scale=1.5, z_offset=0.0
        )
        if plinth_mesh:
            meshes.append(plinth_mesh)

    # ----------------------------------------------------
    # 2. Paved Driveway & Manicured Lawn (Front Setback)
    # ----------------------------------------------------
    if front_setback_depth > 0.8:
        driveway_w = min(b_width * 0.52, 5.2)
        driveway_d = max(front_setback_depth - 0.20, 0.6)
        driveway_x = minx + driveway_w * 0.5 + 0.10
        driveway_y = pminy + 0.10 + driveway_d * 0.5

        driveway_mesh = create_textured_box([driveway_w, driveway_d, 0.08], mat_pavers, uv_meter_scale=1.5)
        driveway_mesh.apply_translation([driveway_x, driveway_y, 0.04])
        meshes.append(driveway_mesh)

        # Manicured lawn on opposite side
        lawn_w = b_width - driveway_w - 0.35
        if lawn_w > 1.2:
            lawn_x = maxx - lawn_w * 0.5 - 0.10
            lawn_mesh = create_textured_box([lawn_w, driveway_d, 0.06], mat_lawn, uv_meter_scale=2.0)
            lawn_mesh.apply_translation([lawn_x, driveway_y, 0.03])
            meshes.append(lawn_mesh)

            # Modern stone walkway pavers stepping through the lawn
            step_count = min(int(driveway_d / 0.8), 5)
            for si in range(step_count):
                step = create_textured_box([0.70, 0.45, 0.025], mat_roof, uv_meter_scale=1.0)
                step_y = pminy + 0.35 + si * 0.80
                step.apply_translation([lawn_x, step_y, 0.075])
                meshes.append(step)

    # ----------------------------------------------------
    # 3. Underground Basement (if configured)
    # ----------------------------------------------------
    if has_basement:
        base_mesh = create_uv_extruded_polygon(
            footprint_poly, height=floor_h, material=mat_concrete, uv_meter_scale=2.0, z_offset=-floor_h
        )
        if base_mesh:
            meshes.append(base_mesh)

    # ----------------------------------------------------
    # 4. Multi-Storey Wall Massing with Cantilevers & Terraces
    # ----------------------------------------------------
    # Determine architectural massing archetype:
    # On 2+ storeys: cantilevered floating upper floor or stepped terrace
    porch_w = min(driveway_w if front_setback_depth > 0.8 else b_width * 0.48, 5.0)
    porch_d = min(b_depth * 0.42, 5.4)
    porch_x = minx + porch_w * 0.5

    for fl in range(floors):
        fl_z0 = plinth_h + fl * floor_h
        fl_z1 = fl_z0 + floor_h

        # Floor polygon geometry
        if fl == 0:
            # Ground floor: full buildable footprint
            fl_poly = footprint_poly
        elif fl == 1:
            # First floor: contemporary Pakistani architecture often cantilevers forward
            # over the entrance or steps back to create a spacious front balcony terrace!
            if b_depth > 11.0:
                # Stepped front terrace on right side, floating cantilever box on left side
                cantilever_box = box(minx, front_y - 0.50, minx + porch_w, maxy)
                fl_poly = footprint_poly.union(cantilever_box)
            else:
                fl_poly = footprint_poly
        else:
            # Second / Third floor: set back from front by 2.0m for rooftop terrace
            fl_poly = footprint_poly.intersection(
                box(minx, front_y + 1.8, maxx, maxy)
            )

        if plot_poly and not plot_poly.is_empty:
            fl_poly = fl_poly.intersection(plot_poly.buffer(-0.02))

        if fl_poly.is_empty:
            fl_poly = footprint_poly
        if isinstance(fl_poly, MultiPolygon):
            fl_poly = max(fl_poly.geoms, key=lambda g: g.area)

        # Floor wall shell
        fl_mesh = create_uv_extruded_polygon(
            fl_poly, height=floor_h, material=mat_wall, uv_meter_scale=2.5, z_offset=fl_z0
        )
        if fl_mesh:
            meshes.append(fl_mesh)

        # Horizontal architectural floor band / slab reveal
        fl_slab_poly = fl_poly.buffer(0.03)
        if plot_poly and not plot_poly.is_empty:
            fl_slab_poly = fl_slab_poly.intersection(plot_poly.buffer(-0.01))
        fl_slab = create_uv_extruded_polygon(
            fl_slab_poly, height=0.22, material=mat_trim, uv_meter_scale=2.0, z_offset=fl_z1 - 0.22
        )
        if fl_slab:
            meshes.append(fl_slab)

    # ----------------------------------------------------
    # 5. Double-Height Vertical Accent Cladding Pier (Feature Tower)
    # ----------------------------------------------------
    pier_w = min(1.4, b_width * 0.20)
    pier_d = 0.38
    pier_h = floors * floor_h + 0.60
    pier_x = maxx - pier_w * 0.5 - 0.30

    pier = create_textured_box([pier_w, pier_d, pier_h], mat_accent, uv_meter_scale=1.5)
    pier.apply_translation([pier_x, front_y - pier_d * 0.5 + 0.10, plinth_h + pier_h * 0.5])
    meshes.append(pier)

    # Pier architectural reveal grooves & warm LED sconce lights
    n_grooves = floors * 4
    for gi in range(n_grooves):
        gz = plinth_h + 0.60 + gi * 0.75
        groove = create_textured_box([pier_w + 0.03, 0.04, 0.03], mat_mullion)
        groove.apply_translation([pier_x, front_y - pier_d + 0.08, gz])
        meshes.append(groove)

    # Modern warm LED exterior wall sconces flanking the pier
    sconce_z = plinth_h + 1.80
    sconce = create_textured_box([0.10, 0.10, 0.28], mat_mullion)
    sconce.apply_translation([pier_x, front_y - pier_d - 0.02, sconce_z])
    meshes.append(sconce)

    sconce_glow = create_textured_box([0.08, 0.06, 0.14], mat_led)
    sconce_glow.apply_translation([pier_x, front_y - pier_d - 0.04, sconce_z])
    meshes.append(sconce_glow)

    # Optional Heritage Mughal Jali Screen on the feature pier
    if has_jali:
        jali_h = 2.40
        jali_w = pier_w * 0.75
        jali_screen = create_textured_box([jali_w, 0.04, jali_h], mat_jali, uv_meter_scale=1.0)
        jali_screen.apply_translation([pier_x, front_y - pier_d - 0.01, plinth_h + 2.50])
        meshes.append(jali_screen)

    # ----------------------------------------------------
    # 6. Photorealistic Recessed Windows (Ground & Upper Floors)
    # ----------------------------------------------------
    wall_recess = 0.16

    # A. Ground Floor Main Drawing Room Window (Right side)
    win_g_w = min(b_width - pier_w - porch_w - 0.8, 3.2)
    if win_g_w > 1.2:
        win_g_x = (minx + porch_w + (maxx - pier_w)) * 0.5
        win_g_h = 1.90
        win_g_z = plinth_h + 0.75
        panes_x = 3 if win_g_w > 2.2 else 2

        g_windows = create_recessed_window(
            width=win_g_w,
            height=win_g_h,
            depth=wall_recess,
            mat_glass=mat_glass,
            mat_mullion=mat_mullion,
            mat_sill=mat_accent,
            panes_x=panes_x,
            panes_y=1,
            has_chajja=True,
        )
        for w_part in g_windows:
            w_part.apply_translation([win_g_x, front_y, win_g_z])
            meshes.append(w_part)

    # B. Upper Floor Bedroom Windows & Balcony Glazing
    if floors >= 2:
        for fl_idx in range(1, floors):
            fl_base_z = plinth_h + fl_idx * floor_h

            # Left bedroom floor-to-ceiling curtain glass (above porch)
            win_u1_w = min(porch_w * 0.80, 2.8)
            win_u1_h = 2.20
            win_u1_z = fl_base_z + 0.40
            u1_windows = create_recessed_window(
                width=win_u1_w,
                height=win_u1_h,
                depth=wall_recess,
                mat_glass=mat_glass,
                mat_mullion=mat_mullion,
                mat_sill=mat_accent,
                panes_x=2,
                panes_y=2,
                has_chajja=True,
            )
            for w_part in u1_windows:
                w_part.apply_translation([porch_x, front_y, win_u1_z])
                meshes.append(w_part)

            # Right bedroom picture window
            if win_g_w > 1.2:
                win_u2_w = win_g_w * 0.85
                win_u2_h = 1.60
                win_u2_z = fl_base_z + 0.85
                u2_windows = create_recessed_window(
                    width=win_u2_w,
                    height=win_u2_h,
                    depth=wall_recess,
                    mat_glass=mat_glass,
                    mat_mullion=mat_mullion,
                    mat_sill=mat_accent,
                    panes_x=2,
                    panes_y=1,
                    has_chajja=True,
                )
                for w_part in u2_windows:
                    w_part.apply_translation([win_g_x, front_y, win_u2_z])
                    meshes.append(w_part)

    # ----------------------------------------------------
    # 7. Grand Main Entrance Door
    # ----------------------------------------------------
    door_w = 1.30
    door_h = 2.45
    door_x = minx + porch_w * 0.82
    door_y = front_y + 0.35
    door_parts = create_architectural_door(
        width=door_w,
        height=door_h,
        mat_door=mat_wood,
        mat_mullion=mat_mullion,
        mat_trim=mat_trim,
    )
    for dp in door_parts:
        dp.apply_translation([door_x, door_y, plinth_h])
        meshes.append(dp)

    # Architectural entrance porch steps (2 steps down to driveway)
    step1 = create_textured_box([door_w + 0.60, 0.90, 0.18], mat_accent, uv_meter_scale=1.5)
    step1.apply_translation([door_x, front_y - 0.45, plinth_h * 0.5])
    meshes.append(step1)

    step2 = create_textured_box([door_w + 0.80, 0.45, 0.12], mat_accent, uv_meter_scale=1.5)
    step2.apply_translation([door_x, front_y - 0.90, plinth_h * 0.25])
    meshes.append(step2)

    # ----------------------------------------------------
    # 8. Luxury Car Porch with Architectural Columns & Timber Louver Ceiling
    # ----------------------------------------------------
    porch_roof_h = plinth_h + floor_h
    # Cantilevered car porch canopy slab
    porch_canopy = create_textured_box([porch_w, porch_d + 0.20, 0.22], mat_trim, uv_meter_scale=2.0)
    porch_canopy.apply_translation([porch_x, front_y + porch_d * 0.5, porch_roof_h - 0.11])
    meshes.append(porch_canopy)

    # Inset warm timber soffit ceiling under the porch canopy
    porch_soffit = create_textured_box([porch_w - 0.08, porch_d + 0.10, 0.03], mat_wood, uv_meter_scale=1.5)
    porch_soffit.apply_translation([porch_x, front_y + porch_d * 0.5, porch_roof_h - 0.23])
    meshes.append(porch_soffit)

    # Recessed LED warm downlights in porch ceiling
    for dl_x in [porch_x - porch_w * 0.28, porch_x + porch_w * 0.28]:
        for dl_y in [front_y + porch_d * 0.30, front_y + porch_d * 0.70]:
            dl = create_textured_box([0.12, 0.12, 0.02], mat_led)
            dl.apply_translation([dl_x, dl_y, porch_roof_h - 0.25])
            meshes.append(dl)

    # Structural Porch Columns (Front-Left & Front-Right)
    col_w = 0.38
    col_d = 0.38
    col_h = porch_roof_h - plinth_h - 0.22
    for cx in [minx + col_w * 0.5 + 0.08, minx + porch_w - col_w * 0.5]:
        col = create_textured_box([col_w, col_d, col_h], mat_accent, uv_meter_scale=1.5)
        col.apply_translation([cx, front_y + col_d * 0.5 + 0.05, plinth_h + col_h * 0.5])
        meshes.append(col)

    # ----------------------------------------------------
    # 9. First-Floor Cantilever Balconies & Terraces
    # ----------------------------------------------------
    if floors >= 2:
        balcony_w = porch_w * 0.90
        balcony_d = 1.35
        balcony_z = plinth_h + floor_h

        # Projecting cantilever balcony slab
        b_slab = create_textured_box([balcony_w, balcony_d, 0.22], mat_trim, uv_meter_scale=2.0)
        b_slab.apply_translation([porch_x, front_y - balcony_d * 0.5 + 0.15, balcony_z + 0.11])
        meshes.append(b_slab)

        # Flooring on balcony
        b_floor = create_textured_box([balcony_w - 0.06, balcony_d - 0.06, 0.03], mat_roof, uv_meter_scale=1.0)
        b_floor.apply_translation([porch_x, front_y - balcony_d * 0.5 + 0.15, balcony_z + 0.235])
        meshes.append(b_floor)

        # Balcony Balustrade (Tempered Glass or Louvers based on style)
        railing_style = "louvers" if style_key == "contemporary_pakistani" else "glass"
        railing_parts = create_balcony_railing(
            width=balcony_w,
            depth=balcony_d,
            height=1.05,
            style=railing_style,
            mat_glass=mat_glass,
            mat_metal=mat_mullion,
            mat_wood=mat_wood,
        )
        for rp in railing_parts:
            rp.apply_translation([porch_x, front_y - balcony_d + 0.15, balcony_z + 0.25])
            meshes.append(rp)

        # Architectural planter box integrated into balcony
        planter_w = balcony_w * 0.40
        planter_d = 0.35
        planter_h = 0.55
        p_box = create_textured_box([planter_w, planter_d, planter_h], mat_accent)
        p_box.apply_translation([porch_x + balcony_w * 0.25, front_y - balcony_d * 0.85, balcony_z + 0.25 + planter_h * 0.5])
        meshes.append(p_box)

        # Foliage in planter
        greenery = create_textured_box([planter_w - 0.06, planter_d - 0.06, 0.25], mat_lawn)
        greenery.apply_translation([porch_x + balcony_w * 0.25, front_y - balcony_d * 0.85, balcony_z + 0.25 + planter_h + 0.10])
        meshes.append(greenery)

    # ----------------------------------------------------
    # 10. Rooftop Terrace, Parapet & Cantilever Pergola
    # ----------------------------------------------------
    roof_z = plinth_h + floors * floor_h

    # Roof slab with textured outdoor terrace tiles
    roof_slab = create_uv_extruded_polygon(
        footprint_poly, height=0.22, material=mat_trim, uv_meter_scale=2.0, z_offset=roof_z
    )
    if roof_slab:
        meshes.append(roof_slab)

    roof_pavers = create_uv_extruded_polygon(
        footprint_poly.buffer(-0.15), height=0.03, material=mat_roof, uv_meter_scale=1.5, z_offset=roof_z + 0.22
    )
    if roof_pavers:
        meshes.append(roof_pavers)

    # Parapet perimeter security wall (0.95m high)
    outer_parapet = footprint_poly
    inner_parapet = footprint_poly.buffer(-0.22)
    if not inner_parapet.is_empty and inner_parapet.area > 5.0:
        parapet_ring = outer_parapet.difference(inner_parapet)
        parapet_mesh = create_uv_extruded_polygon(
            parapet_ring, height=0.95, material=mat_wall, uv_meter_scale=2.0, z_offset=roof_z + 0.22
        )
        if parapet_mesh:
            meshes.append(parapet_mesh)

        # Parapet Coping Cap Stone
        coping_poly = parapet_ring.buffer(0.02)
        if plot_poly and not plot_poly.is_empty:
            coping_poly = coping_poly.intersection(plot_poly.buffer(-0.01))
        coping_mesh = create_uv_extruded_polygon(
            coping_poly, height=0.06, material=mat_accent, uv_meter_scale=2.0, z_offset=roof_z + 1.17
        )
        if coping_mesh:
            meshes.append(coping_mesh)

    # Rooftop Mumty (Stair Tower & Overhead Water Tank)
    mumty_w = min(b_width * 0.40, 3.8)
    mumty_d = min(b_depth * 0.35, 4.2)
    mumty_h = 2.65
    mumty_x = minx + mumty_w * 0.5 + 0.30
    mumty_y = maxy - mumty_d * 0.5 - 0.30

    mumty_box = create_textured_box([mumty_w, mumty_d, mumty_h], mat_wall, uv_meter_scale=2.0)
    mumty_box.apply_translation([mumty_x, mumty_y, roof_z + 0.22 + mumty_h * 0.5])
    meshes.append(mumty_box)

    # Mumty roof coping
    mumty_roof = create_textured_box([mumty_w + 0.16, mumty_d + 0.16, 0.14], mat_accent)
    mumty_roof.apply_translation([mumty_x, mumty_y, roof_z + 0.22 + mumty_h + 0.07])
    meshes.append(mumty_roof)

    # Overhead Water Tank Screened Architectural Enclosure
    tank_w = min(mumty_w * 0.80, 2.2)
    tank_d = min(mumty_d * 0.80, 2.2)
    tank_h = 1.35
    tank_screen = create_textured_box([tank_w, tank_d, tank_h], mat_mullion, uv_meter_scale=1.0)
    tank_screen.apply_translation([mumty_x, mumty_y, roof_z + 0.22 + mumty_h + 0.14 + tank_h * 0.5])
    meshes.append(tank_screen)

    # Rooftop Cantilevered Timber/Metal Pergola Lounge Zone
    pergola_w = min(b_width * 0.48, 4.5)
    pergola_d = min(b_depth * 0.38, 4.2)
    pergola_h = 2.60
    pergola_x = maxx - pergola_w * 0.5 - 0.40
    pergola_y = front_y + pergola_d * 0.5 + 0.80

    pergola_parts = create_cantilevered_pergola(
        width=pergola_w,
        depth=pergola_d,
        height=pergola_h,
        mat_beam=mat_mullion,
        mat_slats=mat_wood,
        slat_count=9,
    )
    for pp in pergola_parts:
        pp.apply_translation([pergola_x, pergola_y - pergola_d * 0.5, roof_z + 0.25])
        meshes.append(pp)

    # ----------------------------------------------------
    # 11. Perimeter Boundary Wall & Sliding Driveway Gate
    # ----------------------------------------------------
    if plot_poly and not plot_poly.is_empty:
        plot_w = pmaxx - pminx
        plot_d = pmaxy - pminy

        outer_plot = plot_poly.buffer(-0.06)
        inner_plot = plot_poly.buffer(-0.25)
        if not inner_plot.is_empty and inner_plot.area > 5.0 and not outer_plot.is_empty:
            wall_ring = outer_plot.difference(inner_plot)
            if isinstance(wall_ring, MultiPolygon):
                wall_ring = max(wall_ring.geoms, key=lambda g: g.area)

            # Elegant low perimeter boundary wall (0.55m high)
            wall_h = 0.55
            wall_mesh = create_uv_extruded_polygon(
                wall_ring, height=wall_h, material=mat_wall, uv_meter_scale=2.0, z_offset=0.0
            )
            if wall_mesh:
                meshes.append(wall_mesh)

            # Dark stone coping cap on boundary wall
            coping_m = create_uv_extruded_polygon(
                wall_ring.buffer(0.03), height=0.06, material=mat_accent, uv_meter_scale=2.0, z_offset=wall_h
            )
            if coping_m:
                meshes.append(coping_m)

            # Main Motorized Driveway Gate (facing front street, inside pminy)
            gp_w = 0.38
            gp_d = 0.38
            gp_y = pminy + 0.08 + gp_d * 0.5
            pillar1_x = max(porch_x - porch_w * 0.5 + gp_w * 0.5, pminx + gp_w * 0.5 + 0.06)
            pillar2_x = min(porch_x + porch_w * 0.5 - gp_w * 0.5, pmaxx - gp_w * 0.5 - 0.06)
            actual_gate_x = (pillar1_x + pillar2_x) * 0.5
            actual_gate_w = max((pillar2_x - gp_w * 0.5) - (pillar1_x + gp_w * 0.5), 1.4)
            gate_h = 1.65

            # Gate Pillars (left & right, strictly inside plot boundary)
            gp1 = create_textured_box([gp_w, gp_d, 1.80], mat_accent, uv_meter_scale=1.5)
            gp1.apply_translation([pillar1_x, gp_y, 0.90])
            meshes.append(gp1)

            gp2 = create_textured_box([gp_w, gp_d, 1.80], mat_accent, uv_meter_scale=1.5)
            gp2.apply_translation([pillar2_x, gp_y, 0.90])
            meshes.append(gp2)

            # Gate Pillar Top Light Caps
            g_light1 = create_textured_box([gp_w + 0.04, gp_d + 0.04, 0.06], mat_trim)
            g_light1.apply_translation([pillar1_x, gp_y, 1.83])
            meshes.append(g_light1)

            g_light2 = create_textured_box([gp_w + 0.04, gp_d + 0.04, 0.06], mat_trim)
            g_light2.apply_translation([pillar2_x, gp_y, 1.83])
            meshes.append(g_light2)

            # Luxury Sliding Gate Outer Frame (Dark Anodized Aluminum)
            gate_frame = create_textured_box([actual_gate_w, 0.06, gate_h], mat_mullion)
            gate_frame.apply_translation([actual_gate_x, gp_y, 0.08 + gate_h * 0.5])
            meshes.append(gate_frame)

            # Horizontal Burmese Teak Infill Slats
            n_slats = 7
            for si in range(n_slats):
                slat = create_textured_box([actual_gate_w - 0.12, 0.05, 0.12], mat_wood, uv_meter_scale=1.5)
                slat_z = 0.22 + si * 0.22
                slat.apply_translation([actual_gate_x, gp_y, slat_z])
                meshes.append(slat)

    # ----------------------------------------------------
    # 12. Combine Scene & Convert to glTF 2.0 Y-Up Standard
    # ----------------------------------------------------
    scene = trimesh.Scene()
    for idx, m in enumerate(meshes):
        if m is not None and len(m.vertices) > 0 and len(m.faces) > 0:
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
