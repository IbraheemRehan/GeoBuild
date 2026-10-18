import math
import numpy as np
from geometry.footprint import get_canonical_frame
from geometry.projection import wgs84_to_utm, utm_to_wgs84

# Test with a known rectangle in Lahore
# Centroid: 74.3587, 31.5204
c_x, c_y = wgs84_to_utm(74.3587, 31.5204, city="lahore")
print(f"Centroid UTM: x={c_x:.2f}, y={c_y:.2f}")

# 10m wide (East-West), 20m deep (North-South)
# Front road is South (y - 10)
# Corner 0: (c_x - 5, c_y - 10)
# Corner 1: (c_x + 5, c_y - 10)
# Corner 2: (c_x + 5, c_y + 10)
# Corner 3: (c_x - 5, c_y + 10)
utm_coords = [
    [c_x - 5, c_y - 10],
    [c_x + 5, c_y - 10],
    [c_x + 5, c_y + 10],
    [c_x - 5, c_y + 10]
]

frame = get_canonical_frame(utm_coords, front_edge_idx=0)
print("u_vec (tangent to street):", frame["u_vec"])
print("v_vec (inward depth):", frame["v_vec"])
print("cesium_heading_deg:", frame["cesium_heading_deg"])
print("bounds:", frame["bounds"])

# u_vec from (c_x - 5, c_y - 10) to (c_x + 5, c_y - 10) is [+1, 0] (East)
# v_vec inward should be [0, 1] (North)
# For v_vec=[0, 1] (pointing North):
# cesium_heading_deg: atan2(0, 1) = 0 deg!
# When heading is 0, Cesium points glTF -Z to North.
# In generator.py: glTF -Z is +canonical Y (which is the rear of the building, towards North).
# And glTF +Z is -canonical Y (which is the front of the building, towards South, facing the road)!
# This means the building front faces the road (South), and rear faces North!
