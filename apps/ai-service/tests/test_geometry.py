"""
GeoBuild AI — Geometry Pipeline Tests
Tests written BEFORE geometry code (Rule 18).
Tests: UTM Projections, Setbacks & Footprint, 3D GLB Generation, Facade Styles.
"""

import pytest
import os
import json
from models import BuildingSpec, Facade, RoomConfig, ParkingConfig
from geometry.projection import (
    get_utm_epsg_for_city,
    wgs84_to_utm,
    utm_to_wgs84,
    polygon_wgs84_to_utm,
    polygon_utm_to_wgs84,
)
from geometry.footprint import (
    compute_buildable_footprint,
    compute_polygon_area_marla,
    MARLA_TO_SQM,
)
from geometry.generator import generate_building_glb, load_facade_presets


class TestProjection:
    """Test UTM projection calculations (Rule 8 & 9)."""

    def test_city_epsg_codes(self):
        assert get_utm_epsg_for_city("lahore") == 32643
        assert get_utm_epsg_for_city("islamabad") == 32643
        assert get_utm_epsg_for_city("karachi") == 32642

    def test_lahore_projection_roundtrip(self):
        # Lahore coordinates: ~74.3587 lon, 31.5204 lat
        lon, lat = 74.3587, 31.5204
        x, y = wgs84_to_utm(lon, lat, city="lahore")
        assert x > 0 and y > 0
        back_lon, back_lat = utm_to_wgs84(x, y, city="lahore")
        assert pytest.approx(lon, rel=1e-5) == back_lon
        assert pytest.approx(lat, rel=1e-5) == back_lat

    def test_karachi_projection_roundtrip(self):
        # Karachi coordinates: ~67.0011 lon, 24.8607 lat
        lon, lat = 67.0011, 24.8607
        x, y = wgs84_to_utm(lon, lat, city="karachi")
        assert x > 0 and y > 0
        back_lon, back_lat = utm_to_wgs84(x, y, city="karachi")
        assert pytest.approx(lon, rel=1e-5) == back_lon
        assert pytest.approx(lat, rel=1e-5) == back_lat


class TestFootprintAndSetbacks:
    """Test plot area, marla conversion, and setback calculation."""

    def test_marla_constant(self):
        # Rule 10: 1 marla ≈ 25.2929 m²
        assert pytest.approx(MARLA_TO_SQM, rel=1e-4) == 25.2929

    def test_rectangular_plot_area(self):
        # 5 marla standard plot: 25ft x 45ft ≈ 7.62m x 13.716m ≈ 104.5m² ≈ 4.13 marla
        # or 126.46 sqm ≈ 5.0 marla
        w, l = 7.62, 16.596  # ~126.46 sqm = exactly 5 marla
        plot_utm = [[0.0, 0.0], [w, 0.0], [w, l], [0.0, l]]
        area_marla, area_sqm = compute_polygon_area_marla(plot_utm)
        assert pytest.approx(area_sqm, rel=1e-2) == 126.46
        assert pytest.approx(area_marla, rel=1e-2) == 5.0

    def test_setback_shrinks_footprint(self):
        # 10 marla plot: 10.67m x 23.7m ≈ 252.9m²
        w, l = 10.67, 23.70
        plot_utm = [[0.0, 0.0], [w, 0.0], [w, l], [0.0, l]]
        # Front setback 3.0m, back 3.0m, left 1.5m, right 0.0m
        footprint_poly, footprint_sqm = compute_buildable_footprint(
            plot_utm=plot_utm,
            front_edge_idx=0,
            setbacks={"front": 3.0, "back": 3.0, "left": 1.5, "right": 0.0},
        )
        assert footprint_poly is not None
        assert footprint_sqm > 0
        assert footprint_sqm < (w * l)  # Must be smaller than original plot


class TestFacadePresets:
    """Test facade preset loading from data/styles/ (Rule 14)."""

    def test_presets_exist_and_load(self):
        presets = load_facade_presets()
        assert "contemporary_pakistani" in presets
        assert "modern_minimal" in presets
        assert "classical" in presets
        assert "mughal_inspired" in presets

        cp = presets["contemporary_pakistani"]
        assert "colors" in cp
        assert "primary" in cp["colors"]
        assert "secondary" in cp["colors"]


class Test3DGeneration:
    """Test procedural GLB generation (Rule 11, 12, 13)."""

    def test_generate_glb_header_and_structure(self):
        # Create a standard 5 marla plot
        w, l = 7.62, 16.596
        plot_utm = [[0.0, 0.0], [w, 0.0], [w, l], [0.0, l]]
        footprint_poly, footprint_sqm = compute_buildable_footprint(
            plot_utm=plot_utm,
            front_edge_idx=0,
            setbacks={"front": 1.5, "back": 1.5, "left": 0.0, "right": 0.0},
        )

        spec = BuildingSpec(
            floors=2,
            floorHeightM=3.05,
            rooftopTerrace=True,
            facade=Facade(style="contemporary_pakistani", hasJali=True, hasBalcony=True),
        )

        glb_bytes, metadata = generate_building_glb(
            footprint_poly=footprint_poly,
            spec=spec,
            plot_utm=plot_utm,
        )

        assert glb_bytes is not None
        assert len(glb_bytes) > 100
        # GLB magic header is 'glTF' (0x46546C67 in little endian or b'glTF')
        assert glb_bytes[:4] == b"glTF"
        assert metadata["total_height_m"] > 6.0
        assert metadata["footprint_sqm"] > 0
