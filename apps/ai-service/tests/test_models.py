"""
GeoBuild AI — Tests for models and fallback parser.
Run: pytest tests/ -v
"""

import pytest
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from models import (
    BuildingSpec,
    InterpretRequest,
    InterpretResponse,
    PatchOperation,
    PatchRequest,
    Facade,
    RoomConfig,
    ParkingConfig,
)
from llm_provider import FallbackParser


class TestBuildingSpec:
    """Test BuildingSpec validation and defaults."""

    def test_default_spec(self):
        spec = BuildingSpec()
        assert spec.floors == 2
        assert spec.rooms.bedrooms == 3
        assert spec.rooms.bathrooms == 3
        assert spec.parking.cars == 1
        assert spec.rooftopTerrace is False
        assert spec.basement is False
        assert spec.facade.style == "contemporary_pakistani"
        assert spec.floorHeightM == 3.05

    def test_valid_spec(self):
        spec = BuildingSpec(
            floors=3,
            basement=True,
            rooms=RoomConfig(bedrooms=5, bathrooms=4),
            parking=ParkingConfig(cars=2, type="basement"),
            rooftopTerrace=True,
            facade=Facade(style="mughal_inspired", hasJali=True),
        )
        assert spec.floors == 3
        assert spec.basement is True
        assert spec.rooms.bedrooms == 5
        assert spec.parking.type == "basement"
        assert spec.facade.hasJali is True

    def test_floor_min_max(self):
        with pytest.raises(Exception):
            BuildingSpec(floors=0)
        with pytest.raises(Exception):
            BuildingSpec(floors=7)

    def test_bedrooms_max(self):
        with pytest.raises(Exception):
            BuildingSpec(rooms=RoomConfig(bedrooms=13))

    def test_parking_max(self):
        with pytest.raises(Exception):
            BuildingSpec(parking=ParkingConfig(cars=9))

    def test_floor_height_range(self):
        with pytest.raises(Exception):
            BuildingSpec(floorHeightM=2.0)
        with pytest.raises(Exception):
            BuildingSpec(floorHeightM=5.0)

    def test_facade_styles(self):
        for style in ["contemporary_pakistani", "modern_minimal", "classical", "mughal_inspired"]:
            spec = BuildingSpec(facade=Facade(style=style))
            assert spec.facade.style == style

    def test_invalid_facade_style(self):
        with pytest.raises(Exception):
            BuildingSpec(facade=Facade(style="art_deco"))


class TestInterpretRequest:
    """Test interpret request validation."""

    def test_valid_request(self):
        req = InterpretRequest(prompt="Build a house", city="lahore")
        assert req.city == "lahore"

    def test_min_prompt_length(self):
        with pytest.raises(Exception):
            InterpretRequest(prompt="hi", city="lahore")

    def test_valid_cities(self):
        for city in ["lahore", "islamabad", "karachi"]:
            req = InterpretRequest(prompt="Build a house", city=city)
            assert req.city == city

    def test_invalid_city(self):
        with pytest.raises(Exception):
            InterpretRequest(prompt="Build a house", city="peshawar")


class TestFallbackParser:
    """Test the regex-based fallback parser."""

    def test_bedrooms(self):
        patches = FallbackParser.parse_to_patches("4 bedrooms")
        assert any(p["path"] == "rooms.bedrooms" and p["value"] == 4 for p in patches)

    def test_floors(self):
        patches = FallbackParser.parse_to_patches("3 floors")
        assert any(p["path"] == "floors" and p["value"] == 3 for p in patches)

    def test_storey(self):
        patches = FallbackParser.parse_to_patches("2 storey house")
        assert any(p["path"] == "floors" and p["value"] == 2 for p in patches)

    def test_parking(self):
        patches = FallbackParser.parse_to_patches("2 car parking")
        assert any(p["path"] == "parking.cars" and p["value"] == 2 for p in patches)

    def test_add_floor(self):
        patches = FallbackParser.parse_to_patches("add a floor")
        assert any(p["path"] == "floors" and p["op"] == "increment" for p in patches)

    def test_rooftop_terrace(self):
        patches = FallbackParser.parse_to_patches("add rooftop terrace")
        assert any(p["path"] == "rooftopTerrace" and p["value"] is True for p in patches)

    def test_basement(self):
        patches = FallbackParser.parse_to_patches("include a basement")
        assert any(p["path"] == "basement" and p["value"] is True for p in patches)

    def test_modern_style(self):
        patches = FallbackParser.parse_to_patches("make it modern")
        assert any(p["path"] == "facade.style" and p["value"] == "modern_minimal" for p in patches)

    def test_mughal_style(self):
        patches = FallbackParser.parse_to_patches("mughal inspired design")
        assert any(p["path"] == "facade.style" and p["value"] == "mughal_inspired" for p in patches)

    def test_jali(self):
        patches = FallbackParser.parse_to_patches("add jali screens")
        assert any(p["path"] == "facade.hasJali" and p["value"] is True for p in patches)

    def test_servant_quarter(self):
        patches = FallbackParser.parse_to_patches("include servant quarter")
        assert any(p["path"] == "rooms.servantQuarter" and p["value"] is True for p in patches)

    def test_combined(self):
        patches = FallbackParser.parse_to_patches(
            "4 bedroom modern house with rooftop terrace and 2 car parking"
        )
        paths = {p["path"] for p in patches}
        assert "rooms.bedrooms" in paths
        assert "facade.style" in paths
        assert "rooftopTerrace" in paths
        assert "parking.cars" in paths

    def test_can_handle_true(self):
        assert FallbackParser.can_handle("3 bedrooms")

    def test_can_handle_false(self):
        assert not FallbackParser.can_handle("hello world how are you")

    def test_empty_string(self):
        patches = FallbackParser.parse_to_patches("")
        assert patches == []
