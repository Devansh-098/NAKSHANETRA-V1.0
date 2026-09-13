"""Parcel geometry: validation and true ground area from WGS84 coordinates."""

from dataclasses import dataclass

from pyproj import CRS, Transformer
from shapely import Point, Polygon
from shapely.ops import transform
from shapely.validation import explain_validity

from app.schemas import Coordinate

SQFT_PER_SQM = 10.763910416709722
SQM_PER_ACRE = 4046.8564224
MIN_AREA_SQ_M = 1.0

WGS84 = CRS.from_epsg(4326)


class InvalidGeometryError(ValueError):
    """Raised when the drawn boundary cannot form a usable parcel polygon."""


@dataclass(frozen=True)
class ParcelMetrics:
    area_sq_m: float
    area_sq_ft: float
    area_acres: float
    representative_point: Coordinate


def build_polygon(coordinates: list[Coordinate]) -> Polygon:
    # Shapely works in (x, y) = (lng, lat).
    points: list[tuple[float, float]] = []
    for c in coordinates:
        p = (c.lng, c.lat)
        if not points or points[-1] != p:  # drop consecutive duplicates (double clicks)
            points.append(p)
    if len(points) > 1 and points[0] == points[-1]:
        points.pop()

    if len(set(points)) < 3:
        raise InvalidGeometryError("A parcel needs at least 3 distinct corner points.")

    polygon = Polygon(points)
    # Use the convex hull: a bow-tie's signed area can cancel to ~0, but only a straight line has no hull area.
    if polygon.is_empty or polygon.convex_hull.area == 0:
        raise InvalidGeometryError("The parcel boundary has no area. Check that the points are not all in a line.")

    if not polygon.is_valid:
        reason = explain_validity(polygon)
        if "Self-intersection" in reason:
            raise InvalidGeometryError("The parcel boundary crosses itself. Redraw it without overlapping edges.")
        raise InvalidGeometryError(f"The parcel boundary is not a valid polygon ({reason.split('[')[0].strip()}).")

    return polygon


def _local_equal_area_crs(lat: float, lng: float) -> CRS:
    # Lambert Azimuthal Equal-Area centred on the parcel: area-preserving by definition and
    # distortion-free near the centre, so it is accurate anywhere in India (and beyond) without
    # having to choose a UTM zone (India spans zones 42N-47N).
    return CRS.from_proj4(f"+proj=laea +lat_0={lat} +lon_0={lng} +datum=WGS84 +units=m +no_defs")


def analyze_parcel(coordinates: list[Coordinate]) -> ParcelMetrics:
    polygon = build_polygon(coordinates)

    centroid = polygon.centroid
    to_metric = Transformer.from_crs(WGS84, _local_equal_area_crs(centroid.y, centroid.x), always_xy=True)
    area_sq_m = transform(to_metric.transform, polygon).area

    if area_sq_m < MIN_AREA_SQ_M:
        raise InvalidGeometryError("The parcel is too small to measure. Zoom in and draw the full boundary.")

    # The centroid of a concave (L/U-shaped) parcel can fall outside it — fall back to a point inside.
    inside: Point = centroid if polygon.contains(centroid) else polygon.representative_point()

    return ParcelMetrics(
        area_sq_m=round(area_sq_m, 2),
        area_sq_ft=round(area_sq_m * SQFT_PER_SQM, 2),
        area_acres=round(area_sq_m / SQM_PER_ACRE, 4),
        representative_point=Coordinate(lat=round(inside.y, 7), lng=round(inside.x, 7)),
    )
