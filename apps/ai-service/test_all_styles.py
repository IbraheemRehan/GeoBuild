from fastapi.testclient import TestClient
from main import app
import base64

client = TestClient(app)
styles = [
    "contemporary_pakistani",
    "modern_minimal",
    "classical",
    "mughal_inspired",
    "industrial_brick",
    "spanish_villa",
    "commercial_plaza"
]

c_lng, c_lat = 74.3587, 31.5204
plot_coords = [
    [c_lng - 0.00004, c_lat - 0.00007],
    [c_lng + 0.00004, c_lat - 0.00007],
    [c_lng + 0.00004, c_lat + 0.00007],
    [c_lng - 0.00004, c_lat + 0.00007],
]

for s in styles:
    r = client.post("/api/v1/generate", json={
        "spec": {"floors": 2, "facade": {"style": s}},
        "plot_polygon_wgs84": plot_coords,
        "front_edge_index": 0,
        "city": "lahore"
    })
    assert r.status_code == 200, f"Failed on style {s}: {r.text}"
    data = r.json()
    b64 = data["glb_base64"]
    raw = base64.b64decode(b64)
    mesh_cnt = data["metadata"]["mesh_count"]
    print(f"Style: {s:25s} | GLB: {len(raw)/1024:.1f} KB | Meshes: {mesh_cnt}")

print("ALL ARCHITECTURAL STYLES PASSED SUCCESSFULLY!")
