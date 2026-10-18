"""
GeoBuild AI — Procedural Architectural PBR Texture Generator
Generates high-resolution (512x512), seamless, tileable PBR diffuse/albedo texture maps
for photorealistic building visualization.
Textures:
- travertine_stucco.png: Warm off-white travertine stucco plaster
- charcoal_slate.png: Dark charcoal architectural slate stone cladding
- burmese_teak.png: Rich warm golden-brown teak wood grain with planks
- makrana_marble.png: Polished white Makrana marble with delicate veining
- terracotta_brick.png: Modern running bond brickwork with mortar lines
- limestone_plaster.png: Colonial warm limestone plaster
- red_sandstone.png: Mughal heritage red sandstone with granular texture
- driveway_pavers.png: Interlocking concrete pavers for driveway
- terrace_tiles.png: Square architectural outdoor porcelain tiles (60x60)
- lawn_grass.png: Lush manicured emerald lawn grass
- architectural_concrete.png: Smooth cast concrete foundation plinth
- solar_glass.png: Reflective tinted glass with depth
- dark_aluminum.png: Sleek anodized dark aluminum mullions
- jali_lattice.png: Traditional geometric Pakistani jali lattice screen
"""

import os
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

TEXTURES_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "data", "styles", "textures")
)
os.makedirs(TEXTURES_DIR, exist_ok=True)
SIZE = 512


def _apply_seamless_perlin_noise(size: int, scale: float = 16.0, octaves: int = 4) -> np.ndarray:
    """Generate seamless 2D tileable noise using periodic sinusoidal synthesis."""
    x = np.linspace(0, 2 * np.pi, size, endpoint=False)
    y = np.linspace(0, 2 * np.pi, size, endpoint=False)
    xv, yv = np.meshgrid(x, y)
    
    noise = np.zeros((size, size), dtype=np.float32)
    amp = 1.0
    for oct_idx in range(1, octaves + 1):
        freq = float(oct_idx * scale / 4.0)
        phase_x = oct_idx * 1.37
        phase_y = oct_idx * 2.81
        term = (
            np.sin(freq * xv + phase_x) * np.cos(freq * yv + phase_y) +
            np.cos(freq * (xv + yv) * 0.7 + phase_x * 0.5) +
            np.sin(freq * (xv - yv) * 0.6 + phase_y * 0.7)
        )
        noise += term * amp
        amp *= 0.5
        
    # Normalize to 0.0 - 1.0
    n_min, n_max = noise.min(), noise.max()
    if n_max > n_min:
        noise = (noise - n_min) / (n_max - n_min)
    return noise


def generate_travertine_stucco():
    """Warm contemporary travertine stucco with fine granular texture and subtle veining."""
    base_color = np.array([234, 228, 220], dtype=np.float32) # #EAE4DC
    noise = _apply_seamless_perlin_noise(SIZE, scale=32.0, octaves=5)
    vein_noise = _apply_seamless_perlin_noise(SIZE, scale=8.0, octaves=3)
    
    # Micro grain
    grain = np.random.normal(0, 4.0, (SIZE, SIZE))
    
    # Subtle horizontal travertine flow
    y_coords = np.linspace(0, 2 * np.pi * 12, SIZE, endpoint=False)
    flow = np.tile(np.sin(y_coords), (SIZE, 1)).T * 3.5
    
    shading = (noise - 0.5) * 16.0 + (vein_noise - 0.5) * 10.0 + grain + flow
    img_arr = np.clip(base_color + shading[:, :, None], 0, 255).astype(np.uint8)
    img = Image.fromarray(img_arr, mode="RGB")
    img.save(os.path.join(TEXTURES_DIR, "travertine_stucco.png"), "PNG", optimize=True)


def generate_charcoal_slate():
    """Architectural dark charcoal split-face slate tile cladding."""
    base_color = np.array([36, 40, 46], dtype=np.float32) # #24282E
    noise = _apply_seamless_perlin_noise(SIZE, scale=24.0, octaves=4)
    grain = np.random.normal(0, 3.5, (SIZE, SIZE))
    
    img_arr = np.clip(base_color + (noise[:, :, None] - 0.5) * 22.0 + grain[:, :, None], 0, 255).astype(np.uint8)
    img = Image.fromarray(img_arr, mode="RGB")
    draw = ImageDraw.Draw(img)
    
    # Architectural horizontal stacked stone courses (64px coursing)
    course_h = 32
    for y in range(0, SIZE, course_h):
        draw.line([(0, y), (SIZE, y)], fill=(18, 20, 24), width=2)
        draw.line([(0, y + 1), (SIZE, y + 1)], fill=(50, 54, 62), width=1)
        
        # Staggered vertical joints
        offset = (y // course_h) % 2 * 64
        for x in range(offset, SIZE, 128):
            draw.line([(x, y), (x, y + course_h)], fill=(18, 20, 24), width=1)
            
    img.save(os.path.join(TEXTURES_DIR, "charcoal_slate.png"), "PNG", optimize=True)


def generate_burmese_teak():
    """Natural golden Burmese teak wood grain with distinct horizontal timber slats/planks."""
    base_color = np.array([125, 75, 42], dtype=np.float32) # #7D4B2A
    
    # Longitudinal wood fibers
    x = np.linspace(0, 2 * np.pi * 4, SIZE, endpoint=False)
    y = np.linspace(0, 2 * np.pi * 32, SIZE, endpoint=False)
    xv, yv = np.meshgrid(x, y)
    
    fiber_noise = _apply_seamless_perlin_noise(SIZE, scale=40.0, octaves=4)
    rings = np.sin(yv + np.sin(xv * 2.0) * 1.5) * 15.0
    grain = np.random.normal(0, 2.5, (SIZE, SIZE))
    
    shading = (fiber_noise - 0.5) * 20.0 + rings + grain
    img_arr = np.clip(base_color + shading[:, :, None] * np.array([1.1, 0.9, 0.7]), 0, 255).astype(np.uint8)
    img = Image.fromarray(img_arr, mode="RGB")
    draw = ImageDraw.Draw(img)
    
    # Modern horizontal timber louver/plank reveals (32px plank width)
    plank_h = 32
    for y in range(0, SIZE, plank_h):
        draw.line([(0, y), (SIZE, y)], fill=(45, 25, 12), width=2)
        draw.line([(0, y + 1), (SIZE, y + 1)], fill=(160, 105, 60), width=1)
        
    img.save(os.path.join(TEXTURES_DIR, "burmese_teak.png"), "PNG", optimize=True)


def generate_makrana_marble():
    """Pure white Makrana marble with delicate grey mineral veining."""
    base_color = np.array([250, 247, 242], dtype=np.float32) # #FAF7F2
    v1 = _apply_seamless_perlin_noise(SIZE, scale=6.0, octaves=4)
    v2 = _apply_seamless_perlin_noise(SIZE, scale=12.0, octaves=3)
    
    # Vein sharpness
    vein = np.abs(v1 - 0.5) * 2.0
    vein = np.exp(-vein * 12.0) * 0.65
    
    vein2 = np.abs(v2 - 0.5) * 2.0
    vein2 = np.exp(-vein2 * 16.0) * 0.4
    
    total_vein = (vein + vein2) * 55.0
    img_arr = np.clip(base_color - total_vein[:, :, None] * np.array([0.9, 0.95, 1.0]), 0, 255).astype(np.uint8)
    img = Image.fromarray(img_arr, mode="RGB")
    img.save(os.path.join(TEXTURES_DIR, "makrana_marble.png"), "PNG", optimize=True)


def generate_terracotta_brick():
    """Modern architectural exposed running-bond brickwork."""
    img = Image.new("RGB", (SIZE, SIZE), color=(175, 82, 55)) # Warm brick base
    draw = ImageDraw.Draw(img)
    
    brick_h = 32
    brick_w = 64
    mortar_color = (215, 210, 202)
    mortar_shadow = (140, 135, 128)
    
    # Background mortar
    img_mortar = Image.new("RGB", (SIZE, SIZE), color=mortar_color)
    draw_m = ImageDraw.Draw(img_mortar)
    
    # Draw individual bricks with subtle color variation
    for row_idx, y in enumerate(range(0, SIZE, brick_h)):
        offset = (brick_w // 2) if (row_idx % 2 == 1) else 0
        for x in range(-offset, SIZE + brick_w, brick_w):
            var = int(np.random.normal(0, 10))
            r = max(min(178 + var, 215), 145)
            g = max(min(85 + var // 2, 115), 65)
            b = max(min(58 + var // 3, 85), 42)
            
            x0 = x + 3
            y0 = y + 3
            x1 = x + brick_w - 2
            y1 = y + brick_h - 2
            draw_m.rectangle([x0, y0, x1, y1], fill=(r, g, b))
            # Subtle highlight on top edge of brick
            draw_m.line([(x0, y0), (x1, y0)], fill=(min(r + 20, 255), min(g + 15, 255), min(b + 10, 255)))
            # Subtle shadow on bottom edge of brick
            draw_m.line([(x0, y1), (x1, y1)], fill=(max(r - 35, 0), max(g - 30, 0), max(b - 25, 0)))
            
    # Add subtle grain noise
    arr = np.array(img_mortar, dtype=np.float32)
    grain = np.random.normal(0, 4.0, (SIZE, SIZE, 1))
    arr = np.clip(arr + grain, 0, 255).astype(np.uint8)
    img_final = Image.fromarray(arr, mode="RGB")
    img_final.save(os.path.join(TEXTURES_DIR, "terracotta_brick.png"), "PNG", optimize=True)


def generate_limestone_plaster():
    """Colonial warm limestone plaster with soft texture."""
    base_color = np.array([243, 236, 225], dtype=np.float32) # #F3ECE1
    noise = _apply_seamless_perlin_noise(SIZE, scale=28.0, octaves=5)
    grain = np.random.normal(0, 3.5, (SIZE, SIZE))
    img_arr = np.clip(base_color + (noise[:, :, None] - 0.5) * 14.0 + grain[:, :, None], 0, 255).astype(np.uint8)
    img = Image.fromarray(img_arr, mode="RGB")
    img.save(os.path.join(TEXTURES_DIR, "limestone_plaster.png"), "PNG", optimize=True)


def generate_red_sandstone():
    """Heritage Mughal red sandstone with fine granular mineral flecks."""
    base_color = np.array([195, 110, 80], dtype=np.float32) # Warm rich red sandstone
    noise = _apply_seamless_perlin_noise(SIZE, scale=20.0, octaves=4)
    grain = np.random.normal(0, 5.5, (SIZE, SIZE))
    img_arr = np.clip(base_color + (noise[:, :, None] - 0.5) * 20.0 + grain[:, :, None], 0, 255).astype(np.uint8)
    img = Image.fromarray(img_arr, mode="RGB")
    img.save(os.path.join(TEXTURES_DIR, "red_sandstone.png"), "PNG", optimize=True)


def generate_driveway_pavers():
    """Modern charcoal interlocking concrete driveway pavers."""
    img = Image.new("RGB", (SIZE, SIZE), color=(28, 30, 34))
    draw = ImageDraw.Draw(img)
    
    tile_w = 64
    tile_h = 32
    
    for row, y in enumerate(range(0, SIZE, tile_h)):
        offset = (tile_w // 2) if (row % 2 == 1) else 0
        for x in range(-offset, SIZE + tile_w, tile_w):
            var = int(np.random.normal(0, 6))
            c = max(min(45 + var, 70), 32)
            x0 = x + 2
            y0 = y + 2
            x1 = x + tile_w - 2
            y1 = y + tile_h - 2
            draw.rectangle([x0, y0, x1, y1], fill=(c, c, c + 2))
            draw.line([(x0, y0), (x1, y0)], fill=(c + 18, c + 18, c + 20))
            draw.line([(x0, y1), (x1, y1)], fill=(c - 16, c - 16, c - 14))
            draw.line([(x1, y0), (x1, y1)], fill=(c - 16, c - 16, c - 14))
            
    arr = np.array(img, dtype=np.float32)
    grain = np.random.normal(0, 3.0, (SIZE, SIZE, 1))
    arr = np.clip(arr + grain, 0, 255).astype(np.uint8)
    img_final = Image.fromarray(arr, mode="RGB")
    img_final.save(os.path.join(TEXTURES_DIR, "driveway_pavers.png"), "PNG", optimize=True)


def generate_terrace_tiles():
    """Modern 60x60cm architectural porcelain outdoor terrace tiles."""
    img = Image.new("RGB", (SIZE, SIZE), color=(48, 52, 60))
    draw = ImageDraw.Draw(img)
    
    tile_size = 128
    for y in range(0, SIZE, tile_size):
        for x in range(0, SIZE, tile_size):
            var = int(np.random.normal(0, 4))
            c = max(min(68 + var, 85), 55)
            x0 = x + 3
            y0 = y + 3
            x1 = x + tile_size - 3
            y1 = y + tile_size - 3
            draw.rectangle([x0, y0, x1, y1], fill=(c, c, c + 2))
            draw.line([(x0, y0), (x1, y0)], fill=(c + 14, c + 14, c + 16))
            draw.line([(x0, y1), (x1, y1)], fill=(c - 14, c - 14, c - 12))
            
    arr = np.array(img, dtype=np.float32)
    noise = _apply_seamless_perlin_noise(SIZE, scale=16.0, octaves=3)
    arr = np.clip(arr + (noise[:, :, None] - 0.5) * 8.0, 0, 255).astype(np.uint8)
    img_final = Image.fromarray(arr, mode="RGB")
    img_final.save(os.path.join(TEXTURES_DIR, "terrace_tiles.png"), "PNG", optimize=True)


def generate_lawn_grass():
    """Lush emerald manicured grass lawn texture."""
    base_color = np.array([42, 92, 32], dtype=np.float32) # Vibrant natural green
    noise = _apply_seamless_perlin_noise(SIZE, scale=36.0, octaves=5)
    micro_blade = np.random.normal(0, 8.0, (SIZE, SIZE))
    
    shading = (noise - 0.5) * 18.0 + micro_blade
    img_arr = np.clip(base_color + shading[:, :, None] * np.array([0.7, 1.1, 0.4]), 0, 255).astype(np.uint8)
    img = Image.fromarray(img_arr, mode="RGB")
    img.save(os.path.join(TEXTURES_DIR, "lawn_grass.png"), "PNG", optimize=True)


def generate_architectural_concrete():
    """Smooth architectural cast concrete plinth stone."""
    base_color = np.array([72, 77, 85], dtype=np.float32) # #484D55
    noise = _apply_seamless_perlin_noise(SIZE, scale=24.0, octaves=4)
    grain = np.random.normal(0, 4.0, (SIZE, SIZE))
    img_arr = np.clip(base_color + (noise[:, :, None] - 0.5) * 12.0 + grain[:, :, None], 0, 255).astype(np.uint8)
    img = Image.fromarray(img_arr, mode="RGB")
    img.save(os.path.join(TEXTURES_DIR, "architectural_concrete.png"), "PNG", optimize=True)


def generate_solar_glass():
    """Reflective dark solar glass with subtle high-contrast gradient."""
    img = Image.new("RGB", (SIZE, SIZE), color=(38, 68, 88))
    draw = ImageDraw.Draw(img)
    # Subtle diagonal architectural reflection sweep
    for y in range(SIZE):
        factor = math.sin((y / SIZE) * math.pi) * 18.0
        c_r = int(38 + factor * 0.4)
        c_g = int(68 + factor * 0.8)
        c_b = int(88 + factor * 1.2)
        draw.line([(0, y), (SIZE, y)], fill=(c_r, c_g, c_b))
    img.save(os.path.join(TEXTURES_DIR, "solar_glass.png"), "PNG", optimize=True)


def generate_dark_aluminum():
    """Sleek anodized dark aluminum architectural metal."""
    base_color = np.array([22, 24, 28], dtype=np.float32)
    grain = np.random.normal(0, 1.8, (SIZE, SIZE))
    img_arr = np.clip(base_color + grain[:, :, None], 0, 255).astype(np.uint8)
    img = Image.fromarray(img_arr, mode="RGB")
    img.save(os.path.join(TEXTURES_DIR, "dark_aluminum.png"), "PNG", optimize=True)


def generate_jali_lattice():
    """Traditional Pakistani octagonal geometric jali screen lattice pattern."""
    img = Image.new("RGBA", (SIZE, SIZE), color=(0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    cell_size = 64
    screen_color = (195, 175, 150, 255) # Light warm sandstone/marble tone
    
    # Fill background
    draw.rectangle([0, 0, SIZE, SIZE], fill=screen_color)
    
    # Cut geometric octagonal perforations
    for y in range(0, SIZE, cell_size):
        for x in range(0, SIZE, cell_size):
            cx = x + cell_size // 2
            cy = y + cell_size // 2
            r = cell_size // 3
            
            # Draw regular octagon hole
            oct_pts = []
            for k in range(8):
                angle = k * (2 * math.pi / 8) + (math.pi / 8)
                oct_pts.append((cx + r * math.cos(angle), cy + r * math.sin(angle)))
            draw.polygon(oct_pts, fill=(0, 0, 0, 0))
            
            # Small diamond at intersections
            d_r = cell_size // 8
            d_pts = [
                (x, y - d_r), (x + d_r, y), (x, y + d_r), (x - d_r, y)
            ]
            draw.polygon(d_pts, fill=(0, 0, 0, 0))
            
    img.save(os.path.join(TEXTURES_DIR, "jali_lattice.png"), "PNG", optimize=True)


def generate_all_textures():
    print("Generating photorealistic architectural PBR textures...")
    generate_travertine_stucco()
    generate_charcoal_slate()
    generate_burmese_teak()
    generate_makrana_marble()
    generate_terracotta_brick()
    generate_limestone_plaster()
    generate_red_sandstone()
    generate_driveway_pavers()
    generate_terrace_tiles()
    generate_lawn_grass()
    generate_architectural_concrete()
    generate_solar_glass()
    generate_dark_aluminum()
    generate_jali_lattice()
    print(f"All 14 PBR textures generated successfully in: {TEXTURES_DIR}")


if __name__ == "__main__":
    generate_all_textures()
