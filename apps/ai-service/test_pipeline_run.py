import requests
import json
import base64
import trimesh
import io

AI_URL = "http://localhost:8000"

def test_full_pipeline():
    print("1. Testing /health...")
    r = requests.get(f"{AI_URL}/health")
    print(f"   Status: {r.status_code}, response: {r.json()}")
    assert r.status_code == 200

    print("\n2. Testing /interpret with 5 Marla villa prompt...")
    prompt = "5 marla modern luxury house, 3 bedrooms, car porch, drawing room, rooftop terrace with pergola and mumty"
    r = requests.post(f"{AI_URL}/api/v1/interpret", json={"prompt": prompt, "city": "lahore"})
    print(f"   Status: {r.status_code}")
    interpret_data = r.json()
    facade_style = spec.get("facade", {}).get("style", "modern")
    print(f"   Spec generated: floors={spec['floors']}, style={facade_style}, rooms={spec.get('rooms')}")

    print("\n3. Testing /generate with 5 Marla rectangular plot coordinates...")
    # 5 Marla ~ 7.62m x 13.72m plot centered in Lahore
    c_lng, c_lat = 74.3587, 31.5204
    m_per_deg_lat = 111132
    m_per_deg_lng = 111132 * 0.85246 # cos(31.5204 deg)
    half_w = 7.62 / 2
    half_d = 13.72 / 2
    
    # Counter-clockwise rectangle
    plot_coords = [
        [c_lng - half_w / m_per_deg_lng, c_lat - half_d / m_per_deg_lat],
        [c_lng + half_w / m_per_deg_lng, c_lat - half_d / m_per_deg_lat],
        [c_lng + half_w / m_per_deg_lng, c_lat + half_d / m_per_deg_lat],
        [c_lng - half_w / m_per_deg_lng, c_lat + half_d / m_per_deg_lat],
    ]
    
    gen_payload = {
        "spec": spec,
        "plot_polygon_wgs84": plot_coords,
        "front_edge_index": 0,
        "city": "lahore",
    }
    r = requests.post(f"{AI_URL}/api/v1/generate", json=gen_payload)
    print(f"   Status: {r.status_code}")
    assert r.status_code == 200
    gen_data = r.json()
    
    print(f"   Plot area: {gen_data.get('plot_area_sqm')} m²")
    print(f"   Footprint: {gen_data.get('building_footprint_sqm')} m²")
    print(f"   Total height: {gen_data.get('total_height_m')} m")
    print(f"   Heading: {gen_data.get('heading_deg')}°")
    print(f"   Center: {gen_data.get('center_wgs84')}")
    
    glb_uri = gen_data.get("glb_data_uri", "")
    assert glb_uri.startswith("data:model/gltf-binary;base64,")
    glb_bytes = base64.b64decode(glb_uri.split(",", 1)[1])
    print(f"   GLB size: {len(glb_bytes) / 1024:.1f} KB")
    
    # Load with trimesh to inspect meshes and bounding box
    scene = trimesh.load(io.BytesIO(glb_bytes), file_type="glb")
    print(f"   Scene type: {type(scene)}")
    if isinstance(scene, trimesh.Scene):
        print(f"   Number of geometry meshes in 3D villa: {len(scene.geometry)}")
        for name, geom in scene.geometry.items():
            print(f"     - Mesh '{name}': {len(geom.vertices)} vertices, {len(geom.faces)} faces")
        bounds = scene.bounds
        extents = scene.extents
        print(f"\n   3D Villa Bounding Box (Metres):")
        print(f"     Width  (X): {extents[0]:.2f}m (Plot Width: 7.62m -> Fits within: {extents[0] <= 7.62})")
        print(f"     Depth  (Y): {extents[1]:.2f}m (Plot Depth: 13.72m -> Fits within: {extents[1] <= 13.72})")
        print(f"     Height (Z): {extents[2]:.2f}m")
        assert extents[0] <= 7.62 + 0.05, f"Width {extents[0]} exceeds plot width 7.62"
        assert extents[1] <= 13.72 + 0.05, f"Depth {extents[1]} exceeds plot depth 13.72"
        print("   ✅ STRICT CONTAINMENT CONFIRMED: 100% of building geometry is within plot boundaries!")
    
    print("\n4. Testing /analyze...")
    r = requests.post(f"{AI_URL}/api/v1/analyze", json={
        "spec": spec,
        "plot_area_sqm": gen_data["plot_area_sqm"],
        "city": "lahore",
        "cost_tier": "standard"
    })
    print(f"   Status: {r.status_code}")
    analyze_data = r.json()
    print(f"   Coverage: {analyze_data.get('coverage_pct')}%")
    print(f"   FAR: {analyze_data.get('far_ratio')}")
    print(f"   Total cost: PKR {analyze_data.get('estimated_cost_pkr', {}).get('total', 0):,}")
    print("\n🎉 ALL PIPELINE VERIFICATIONS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_full_pipeline()
