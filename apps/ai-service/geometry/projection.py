"""
GeoBuild AI — Projection Module
Converts between WGS84 (EPSG:4326) and UTM projections.
Rule 8: Lahore & Islamabad use EPSG:32643; Karachi uses EPSG:32642.
Rule 9: Geographic coordinates (lat/lon) use WGS84 (EPSG:4326).
"""

from pyproj import Transformer

CITY_UTM_EPSG = {
    "lahore": 32643,      # UTM Zone 43N
    "islamabad": 32643,   # UTM Zone 43N
    "karachi": 32642,     # UTM Zone 42N
}

# Cache pyproj Transformers for high performance
_TRANSFORMERS_TO_UTM: dict[int, Transformer] = {}
_TRANSFORMERS_TO_WGS84: dict[int, Transformer] = {}


def get_utm_epsg_for_city(city: str) -> int:
    """Return the EPSG code for the specified Pakistani city."""
    normalized = city.lower().strip()
    return CITY_UTM_EPSG.get(normalized, 32643)


def _get_to_utm_transformer(epsg: int) -> Transformer:
    if epsg not in _TRANSFORMERS_TO_UTM:
        _TRANSFORMERS_TO_UTM[epsg] = Transformer.from_crs("EPSG:4326", f"EPSG:{epsg}", always_xy=True)
    return _TRANSFORMERS_TO_UTM[epsg]


def _get_to_wgs84_transformer(epsg: int) -> Transformer:
    if epsg not in _TRANSFORMERS_TO_WGS84:
        _TRANSFORMERS_TO_WGS84[epsg] = Transformer.from_crs(f"EPSG:{epsg}", "EPSG:4326", always_xy=True)
    return _TRANSFORMERS_TO_WGS84[epsg]


def wgs84_to_utm(lon: float, lat: float, city: str = "lahore") -> tuple[float, float]:
    """Convert WGS84 (lon, lat) to UTM (easting, northing) in metres."""
    epsg = get_utm_epsg_for_city(city)
    transformer = _get_to_utm_transformer(epsg)
    x, y = transformer.transform(lon, lat)
    return float(x), float(y)


def utm_to_wgs84(x: float, y: float, city: str = "lahore") -> tuple[float, float]:
    """Convert UTM (easting, northing) in metres to WGS84 (lon, lat)."""
    epsg = get_utm_epsg_for_city(city)
    transformer = _get_to_wgs84_transformer(epsg)
    lon, lat = transformer.transform(x, y)
    return float(lon), float(lat)


def polygon_wgs84_to_utm(coords: list[list[float]], city: str = "lahore") -> list[list[float]]:
    """Convert a list of [lon, lat] coordinates to UTM [x, y]."""
    return [list(wgs84_to_utm(p[0], p[1], city=city)) for p in coords]


def polygon_utm_to_wgs84(coords: list[list[float]], city: str = "lahore") -> list[list[float]]:
    """Convert a list of UTM [x, y] coordinates to WGS84 [lon, lat]."""
    return [list(utm_to_wgs84(p[0], p[1], city=city)) for p in coords]
