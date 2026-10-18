"""
GeoBuild AI — Texture and PBR Material Management
Loads seamless tileable PBR texture images and builds UV-mapped architectural meshes.
Rule 11: Procedural geometry only — no AI-generated meshes.
Rule 12: All 3D output is GLB format.
Rule 14: Facade styles come from data/styles/*.json.
"""

from __future__ import annotations
import os
import math
from typing import Any
import numpy as np
from PIL import Image
import trimesh
from trimesh.visual.texture import TextureVisuals
from trimesh.visual.material import PBRMaterial
from shapely.geometry import Polygon, MultiPolygon

TEXTURES_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "data", "styles", "textures")
)

_IMAGE_CACHE: dict[str, Image.Image] = {}
_MATERIAL_CACHE: dict[str, PBRMaterial] = {}


def load_texture_image(filename: str) -> Image.Image:
    """Load and cache texture image from data/styles/textures/."""
    if filename in _IMAGE_CACHE:
        return _IMAGE_CACHE[filename]

    filepath = os.path.join(TEXTURES_DIR, filename)
    if os.path.exists(filepath):
        img = Image.open(filepath).convert("RGB")
        _IMAGE_CACHE[filename] = img
        return img

    # Fallback placeholder image if file missing
    placeholder = Image.new("RGB", (64, 64), color=(220, 215, 205))
    _IMAGE_CACHE[filename] = placeholder
    return placeholder


def _hex_to_rgba(hex_code: str, alpha: float = 1.0) -> list[float]:
    """Convert hex string (e.g. #D4B896) to [R, G, B, A] floats 0.0-1.0."""
    clean = hex_code.lstrip("#")
    if len(clean) == 6:
        r = int(clean[0:2], 16) / 255.0
        g = int(clean[2:4], 16) / 255.0
        b = int(clean[4:6], 16) / 255.0
        return [r, g, b, alpha]
    return [0.9, 0.88, 0.85, alpha]


def create_pbr_material(
    name: str,
    texture_filename: str | None = None,
    hex_color: str | None = None,
    roughness: float = 0.65,
    metallic: float = 0.0,
    alpha: float = 1.0,
    alpha_mode: str = "OPAQUE",
    emissive_hex: str | None = None,
) -> PBRMaterial:
    """Create or retrieve a cached glTF 2.0 PBR material with optional texture map."""
    cache_key = f"{name}_{texture_filename}_{hex_color}_{roughness}_{metallic}_{alpha}"
    if cache_key in _MATERIAL_CACHE:
        return _MATERIAL_CACHE[cache_key]

    kwargs: dict[str, Any] = {
        "name": name,
        "roughnessFactor": float(roughness),
        "metallicFactor": float(metallic),
        "alphaMode": alpha_mode,
    }

    if hex_color:
        kwargs["baseColorFactor"] = _hex_to_rgba(hex_color, alpha)
    else:
        kwargs["baseColorFactor"] = [1.0, 1.0, 1.0, alpha]

    if texture_filename:
        tex_img = load_texture_image(texture_filename)
        kwargs["baseColorTexture"] = tex_img

    if emissive_hex:
        er, eg, eb, _ = _hex_to_rgba(emissive_hex, 1.0)
        kwargs["emissiveFactor"] = [er, eg, eb]

    mat = PBRMaterial(**kwargs)
    _MATERIAL_CACHE[cache_key] = mat
    return mat


def get_material_library(style_key: str = "contemporary_pakistani") -> dict[str, PBRMaterial]:
    """
    Get cohesive suite of photorealistic architectural PBR materials for the given style.
    Materials share underlying textures so GLB size stays compact.
    """
    if style_key == "classical":
        wall_tex = "limestone_plaster.png"
        accent_tex = "travertine_stucco.png"
    elif style_key == "mughal_inspired":
        wall_tex = "red_sandstone.png"
        accent_tex = "makrana_marble.png"
    elif style_key == "industrial_brick":
        wall_tex = "terracotta_brick.png"
        accent_tex = "charcoal_slate.png"
    elif style_key == "spanish_villa":
        wall_tex = "limestone_plaster.png"
        accent_tex = "terracotta_brick.png"
    elif style_key == "commercial_plaza":
        wall_tex = "charcoal_slate.png"
        accent_tex = "travertine_stucco.png"
    elif style_key == "modern_minimal":
        wall_tex = "travertine_stucco.png"
        accent_tex = "charcoal_slate.png"
    else: # contemporary_pakistani and default
        wall_tex = "travertine_stucco.png"
        accent_tex = "charcoal_slate.png"

    return {
        "wall": create_pbr_material("Mat_Facade_Wall", wall_tex, roughness=0.72, metallic=0.01),
        "wall_secondary": create_pbr_material("Mat_Secondary_Wall", "travertine_stucco.png", hex_color="#D9D2C7", roughness=0.75),
        "accent": create_pbr_material("Mat_Accent_Cladding", accent_tex, roughness=0.35, metallic=0.10),
        "wood": create_pbr_material("Mat_Burmese_Teak", "burmese_teak.png", roughness=0.30, metallic=0.04),
        "brick": create_pbr_material("Mat_Terracotta_Brick", "terracotta_brick.png", roughness=0.80, metallic=0.01),
        "marble": create_pbr_material("Mat_Makrana_Marble", "makrana_marble.png", roughness=0.18, metallic=0.05),
        "concrete": create_pbr_material("Mat_Architectural_Concrete", "architectural_concrete.png", roughness=0.68, metallic=0.05),
        "glass": create_pbr_material("Mat_Solar_Glass", "solar_glass.png", hex_color="#2E4D60", roughness=0.04, metallic=0.35, alpha=0.55, alpha_mode="BLEND"),
        "mullion": create_pbr_material("Mat_Dark_Aluminum", "dark_aluminum.png", hex_color="#181A1E", roughness=0.22, metallic=0.85),
        "trim": create_pbr_material("Mat_Trim_Metal", "dark_aluminum.png", hex_color="#4B5563", roughness=0.35, metallic=0.70),
        "pavers": create_pbr_material("Mat_Driveway_Pavers", "driveway_pavers.png", roughness=0.85, metallic=0.02),
        "roof": create_pbr_material("Mat_Terrace_Tiles", "terrace_tiles.png", roughness=0.80, metallic=0.03),
        "lawn": create_pbr_material("Mat_Manicured_Lawn", "lawn_grass.png", roughness=0.95, metallic=0.0),
        "jali": create_pbr_material("Mat_Jali_Screen", "jali_lattice.png", hex_color="#E2D9CC", roughness=0.45, metallic=0.05),
        "led_warm": create_pbr_material("Mat_LED_Warm_Accent", None, hex_color="#FFF8E7", roughness=0.10, metallic=0.0, emissive_hex="#FDE047"),
    }


def create_textured_box(
    extents: list[float] | tuple[float, float, float],
    material: PBRMaterial,
    uv_meter_scale: float = 2.0,
) -> trimesh.Trimesh:
    """
    Create a cuboid with independent vertices per face (24 vertices, 12 triangles)
    and metric UV coordinates (1 texture repeat per uv_meter_scale metres).
    """
    dx, dy, dz = extents[0] / 2.0, extents[1] / 2.0, extents[2] / 2.0
    w, d, h = float(extents[0]), float(extents[1]), float(extents[2])
    scale = max(float(uv_meter_scale), 0.1)

    # 6 faces: Front (+Y), Back (-Y), Left (-X), Right (+X), Top (+Z), Bottom (-Z)
    faces_data = [
        # Front face (+Y in canonical coordinates)
        {
            "verts": [[-dx, dy, -dz], [dx, dy, -dz], [dx, dy, dz], [-dx, dy, dz]],
            "u_span": w / scale,
            "v_span": h / scale,
        },
        # Back face (-Y)
        {
            "verts": [[dx, -dy, -dz], [-dx, -dy, -dz], [-dx, -dy, dz], [dx, -dy, dz]],
            "u_span": w / scale,
            "v_span": h / scale,
        },
        # Left face (-X)
        {
            "verts": [[-dx, -dy, -dz], [-dx, dy, -dz], [-dx, dy, dz], [-dx, -dy, dz]],
            "u_span": d / scale,
            "v_span": h / scale,
        },
        # Right face (+X)
        {
            "verts": [[dx, dy, -dz], [dx, -dy, -dz], [dx, -dy, dz], [dx, dy, dz]],
            "u_span": d / scale,
            "v_span": h / scale,
        },
        # Top face (+Z)
        {
            "verts": [[-dx, -dy, dz], [dx, -dy, dz], [dx, dy, dz], [-dx, dy, dz]],
            "u_span": w / scale,
            "v_span": d / scale,
        },
        # Bottom face (-Z)
        {
            "verts": [[-dx, dy, -dz], [dx, dy, -dz], [dx, -dy, -dz], [-dx, -dy, -dz]],
            "u_span": w / scale,
            "v_span": d / scale,
        },
    ]

    all_verts: list[list[float]] = []
    all_uvs: list[list[float]] = []
    all_indices: list[list[int]] = []

    for f in faces_data:
        base_v = len(all_verts)
        all_verts.extend(f["verts"])
        u_max = float(f["u_span"])
        v_max = float(f["v_span"])
        all_uvs.extend([
            [0.0, 0.0],
            [u_max, 0.0],
            [u_max, v_max],
            [0.0, v_max],
        ])
        all_indices.extend([
            [base_v, base_v + 1, base_v + 2],
            [base_v, base_v + 2, base_v + 3],
        ])

    visual = TextureVisuals(uv=np.array(all_uvs, dtype=np.float32), material=material)
    mesh = trimesh.Trimesh(
        vertices=np.array(all_verts, dtype=np.float32),
        faces=np.array(all_indices, dtype=np.int32),
        visual=visual,
        process=False,
    )
    return mesh


def create_uv_extruded_polygon(
    poly: Polygon,
    height: float,
    material: PBRMaterial,
    uv_meter_scale: float = 2.0,
    z_offset: float = 0.0,
) -> trimesh.Trimesh | None:
    """
    Extrude a 2D shapely polygon with clean, metric UV mapping on side walls and caps.
    """
    if poly.is_empty or poly.area < 0.1:
        return None

    if isinstance(poly, MultiPolygon):
        poly = max(poly.geoms, key=lambda g: g.area)

    coords = list(poly.exterior.coords)
    if coords[0] == coords[-1]:
        coords = coords[:-1]
    n_pts = len(coords)
    if n_pts < 3:
        return None

    scale = max(float(uv_meter_scale), 0.1)
    h = float(height)
    z0 = float(z_offset)
    z1 = z0 + h

    vertices: list[list[float]] = []
    uvs: list[list[float]] = []
    indices: list[list[int]] = []

    # 1. Side wall quads with perimeter metric UV mapping
    total_len = 0.0
    cum_lens = [0.0]
    for i in range(n_pts):
        p0 = np.array(coords[i])
        p1 = np.array(coords[(i + 1) % n_pts])
        edge_len = float(np.linalg.norm(p1 - p0))
        total_len += edge_len
        cum_lens.append(total_len)

    v0_wall = 0.0
    v1_wall = h / scale

    for i in range(n_pts):
        p0 = coords[i]
        p1 = coords[(i + 1) % n_pts]
        u0 = cum_lens[i] / scale
        u1 = cum_lens[i + 1] / scale

        base = len(vertices)
        vertices.extend([
            [p0[0], p0[1], z0],
            [p1[0], p1[1], z0],
            [p1[0], p1[1], z1],
            [p0[0], p0[1], z1],
        ])
        uvs.extend([
            [u0, v0_wall],
            [u1, v0_wall],
            [u1, v1_wall],
            [u0, v1_wall],
        ])
        indices.extend([
            [base, base + 1, base + 2],
            [base, base + 2, base + 3],
        ])

    # 2. Triangulate caps
    try:
        tri_verts, tri_faces = trimesh.creation.triangulate_polygon(poly)
    except Exception:
        tri_verts, tri_faces = np.empty((0, 2)), np.empty((0, 3), dtype=np.int32)

    if len(tri_verts) > 0 and len(tri_faces) > 0:
        # Top cap at z1
        base_top = len(vertices)
        for v in tri_verts:
            vertices.append([float(v[0]), float(v[1]), z1])
            uvs.append([float(v[0]) / scale, float(v[1]) / scale])
        for f in tri_faces:
            indices.append([base_top + int(f[0]), base_top + int(f[1]), base_top + int(f[2])])

        # Bottom cap at z0 (reversed winding for downward-facing normal)
        base_bot = len(vertices)
        for v in tri_verts:
            vertices.append([float(v[0]), float(v[1]), z0])
            uvs.append([float(v[0]) / scale, float(v[1]) / scale])
        for f in tri_faces:
            indices.append([base_bot + int(f[2]), base_bot + int(f[1]), base_bot + int(f[0])])

    visual = TextureVisuals(uv=np.array(uvs, dtype=np.float32), material=material)
    return trimesh.Trimesh(
        vertices=np.array(vertices, dtype=np.float32),
        faces=np.array(indices, dtype=np.int32),
        visual=visual,
        process=False,
    )


def create_recessed_window(
    width: float,
    height: float,
    depth: float,
    mat_glass: PBRMaterial,
    mat_mullion: PBRMaterial,
    mat_sill: PBRMaterial,
    panes_x: int = 2,
    panes_y: int = 1,
    has_chajja: bool = True,
) -> list[trimesh.Trimesh]:
    """
    Construct a realistic recessed window assembly:
    - Stone window sill at bottom (cantilevered 5cm)
    - Optional weather sunshade / chajja at top
    - Outer aluminum reveal frame
    - Vertical and horizontal aluminum mullions
    - Recessed reflective solar glass panes set inside the frame
    All meshes returned in local frame centered at (0, 0, height/2).
    """
    meshes: list[trimesh.Trimesh] = []
    frame_th = 0.05  # 5cm thick aluminum frame
    recess_d = max(depth, 0.14)

    # 1. Projecting Architectural Window Sill (White/Stone Accent at bottom)
    sill_w = width + 0.16
    sill_d = recess_d + 0.08
    sill_h = 0.06
    sill = create_textured_box([sill_w, sill_d, sill_h], mat_sill)
    sill.apply_translation([0, -0.02, -sill_h * 0.5])
    meshes.append(sill)

    # 2. Weather Sunshade (Chajja) at top (Cantilevered 25cm to cast realistic facade shadows)
    if has_chajja:
        chajja_w = width + 0.20
        chajja_d = recess_d + 0.22
        chajja_h = 0.07
        chajja = create_textured_box([chajja_w, chajja_d, chajja_h], mat_sill)
        chajja.apply_translation([0, -0.06, height + chajja_h * 0.5])
        meshes.append(chajja)

    # 3. Outer Aluminum Perimeter Frame (Left, Right, Top, Bottom)
    # Left jamb
    jamb_l = create_textured_box([frame_th, recess_d, height], mat_mullion)
    jamb_l.apply_translation([-width * 0.5 + frame_th * 0.5, 0, height * 0.5])
    meshes.append(jamb_l)

    # Right jamb
    jamb_r = create_textured_box([frame_th, recess_d, height], mat_mullion)
    jamb_r.apply_translation([width * 0.5 - frame_th * 0.5, 0, height * 0.5])
    meshes.append(jamb_r)

    # Top head
    head = create_textured_box([width - 2 * frame_th, recess_d, frame_th], mat_mullion)
    head.apply_translation([0, 0, height - frame_th * 0.5])
    meshes.append(head)

    # Bottom sill frame
    bot_frame = create_textured_box([width - 2 * frame_th, recess_d, frame_th], mat_mullion)
    bot_frame.apply_translation([0, 0, frame_th * 0.5])
    meshes.append(bot_frame)

    # 4. Interior Vertical Mullion Dividers
    inner_w = width - 2 * frame_th
    inner_h = height - 2 * frame_th
    mullion_w = 0.04

    if panes_x > 1:
        spacing_x = inner_w / panes_x
        for i in range(1, panes_x):
            mx = -inner_w * 0.5 + i * spacing_x
            v_mullion = create_textured_box([mullion_w, recess_d * 0.85, inner_h], mat_mullion)
            v_mullion.apply_translation([mx, 0, height * 0.5])
            meshes.append(v_mullion)

    if panes_y > 1:
        spacing_y = inner_h / panes_y
        for j in range(1, panes_y):
            my = frame_th + j * spacing_y
            h_mullion = create_textured_box([inner_w, recess_d * 0.85, mullion_w], mat_mullion)
            h_mullion.apply_translation([0, 0, my])
            meshes.append(h_mullion)

    # 5. Solar Reflective Glass Pane (Recessed towards the interior for true architectural depth)
    glass_w = inner_w - 0.01
    glass_h = inner_h - 0.01
    glass_pane = create_textured_box([glass_w, 0.02, glass_h], mat_glass)
    glass_pane.apply_translation([0, recess_d * 0.25, height * 0.5])
    meshes.append(glass_pane)

    return meshes


def create_architectural_door(
    width: float,
    height: float,
    mat_door: PBRMaterial,
    mat_mullion: PBRMaterial,
    mat_trim: PBRMaterial,
) -> list[trimesh.Trimesh]:
    """
    Construct a luxury pivot entrance door with Burmese teak wood grain,
    black aluminum jambs, and vertical architectural pull bar handle.
    """
    meshes: list[trimesh.Trimesh] = []
    frame_th = 0.06

    # 1. Door Frame Jambs
    jamb_l = create_textured_box([frame_th, 0.16, height], mat_mullion)
    jamb_l.apply_translation([-width * 0.5 + frame_th * 0.5, 0, height * 0.5])
    meshes.append(jamb_l)

    jamb_r = create_textured_box([frame_th, 0.16, height], mat_mullion)
    jamb_r.apply_translation([width * 0.5 - frame_th * 0.5, 0, height * 0.5])
    meshes.append(jamb_r)

    lintel = create_textured_box([width, 0.16, frame_th], mat_mullion)
    lintel.apply_translation([0, 0, height - frame_th * 0.5])
    meshes.append(lintel)

    # 2. Main Teak Door Leaf
    leaf_w = width - 2 * frame_th - 0.01
    leaf_h = height - frame_th - 0.01
    leaf = create_textured_box([leaf_w, 0.06, leaf_h], mat_door, uv_meter_scale=1.5)
    leaf.apply_translation([0, 0, leaf_h * 0.5])
    meshes.append(leaf)

    # 3. Luxury Vertical Stainless Steel Handle Bar (1.2m long)
    handle_h = 1.10
    handle_x = leaf_w * 0.32
    handle_z = height * 0.45
    handle = create_textured_box([0.03, 0.03, handle_h], mat_trim)
    handle.apply_translation([handle_x, -0.045, handle_z])
    meshes.append(handle)

    # Handle standoffs
    for so_z in [handle_z - handle_h * 0.4, handle_z + handle_h * 0.4]:
        standoff = create_textured_box([0.02, 0.035, 0.02], mat_trim)
        standoff.apply_translation([handle_x, -0.025, so_z])
        meshes.append(standoff)

    return meshes


def create_balcony_railing(
    width: float,
    depth: float,
    height: float = 1.05,
    style: str = "glass",
    mat_glass: PBRMaterial | None = None,
    mat_metal: PBRMaterial | None = None,
    mat_wood: PBRMaterial | None = None,
) -> list[trimesh.Trimesh]:
    """
    Construct a photorealistic perimeter balcony balustrade.
    Options: 'glass', 'louvers', 'steel'.
    """
    meshes: list[trimesh.Trimesh] = []
    post_th = 0.04

    # Perimeter segments: Front (length width), Left (length depth), Right (length depth)
    # Handrail (top capping rail around 3 sides)
    handrail_top = 0.04
    # Front rail
    hr_f = create_textured_box([width, 0.05, handrail_top], mat_metal)
    hr_f.apply_translation([0, depth, height - handrail_top * 0.5])
    meshes.append(hr_f)

    # Left rail
    hr_l = create_textured_box([0.05, depth, handrail_top], mat_metal)
    hr_l.apply_translation([-width * 0.5 + 0.025, depth * 0.5, height - handrail_top * 0.5])
    meshes.append(hr_l)

    # Right rail
    hr_r = create_textured_box([0.05, depth, handrail_top], mat_metal)
    hr_r.apply_translation([width * 0.5 - 0.025, depth * 0.5, height - handrail_top * 0.5])
    meshes.append(hr_r)

    # Corner and intermediate posts
    post_positions = [
        [-width * 0.5 + 0.025, 0.025],
        [width * 0.5 - 0.025, 0.025],
        [-width * 0.5 + 0.025, depth - 0.025],
        [width * 0.5 - 0.025, depth - 0.025],
        [0.0, depth - 0.025],
    ]
    for px, py in post_positions:
        post = create_textured_box([post_th, post_th, height], mat_metal)
        post.apply_translation([px, py, height * 0.5])
        meshes.append(post)

    if style == "glass" and mat_glass:
        # Front tempered glass panel
        g_front = create_textured_box([width - 0.12, 0.015, height - 0.15], mat_glass)
        g_front.apply_translation([0, depth - 0.01, height * 0.45])
        meshes.append(g_front)

        # Left & Right glass panels
        if depth > 0.4:
            g_left = create_textured_box([0.015, depth - 0.08, height - 0.15], mat_glass)
            g_left.apply_translation([-width * 0.5 + 0.025, depth * 0.5, height * 0.45])
            meshes.append(g_left)

            g_right = create_textured_box([0.015, depth - 0.08, height - 0.15], mat_glass)
            g_right.apply_translation([width * 0.5 - 0.025, depth * 0.5, height * 0.45])
            meshes.append(g_right)

    elif style == "louvers" and mat_wood:
        # Horizontal warm teak wood louver slats
        n_slats = 5
        slat_h = 0.07
        for s in range(n_slats):
            sz = 0.18 + s * 0.17
            slat_f = create_textured_box([width - 0.08, 0.025, slat_h], mat_wood, uv_meter_scale=1.5)
            slat_f.apply_translation([0, depth - 0.01, sz])
            meshes.append(slat_f)

    return meshes


def create_cantilevered_pergola(
    width: float,
    depth: float,
    height: float,
    mat_beam: PBRMaterial,
    mat_slats: PBRMaterial,
    slat_count: int = 9,
) -> list[trimesh.Trimesh]:
    """
    Construct a contemporary architectural roof / car porch pergola.
    Features main structural cantilever beams + spaced horizontal shade louvers.
    """
    meshes: list[trimesh.Trimesh] = []
    beam_w = 0.12
    beam_h = 0.22

    # 1. Main longitudinal cantilever beams (spanning depth)
    b_left = create_textured_box([beam_w, depth, beam_h], mat_beam)
    b_left.apply_translation([-width * 0.5 + beam_w * 0.5, depth * 0.5, height - beam_h * 0.5])
    meshes.append(b_left)

    b_right = create_textured_box([beam_w, depth, beam_h], mat_beam)
    b_right.apply_translation([width * 0.5 - beam_w * 0.5, depth * 0.5, height - beam_h * 0.5])
    meshes.append(b_right)

    if width > 4.5:
        b_mid = create_textured_box([beam_w, depth, beam_h], mat_beam)
        b_mid.apply_translation([0, depth * 0.5, height - beam_h * 0.5])
        meshes.append(b_mid)

    # 2. Transverse horizontal shade louvers (spaced across depth)
    slat_th = 0.04
    slat_d = 0.14
    slat_z = height + slat_d * 0.5 - 0.02
    spacing = depth / (slat_count + 1)

    for i in range(1, slat_count + 1):
        sy = i * spacing
        slat = create_textured_box([width + 0.10, slat_th, slat_d], mat_slats, uv_meter_scale=1.5)
        slat.apply_translation([0, sy, slat_z])
        meshes.append(slat)

    return meshes
