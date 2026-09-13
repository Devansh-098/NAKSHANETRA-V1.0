"""Server-side Google Maps access. Only reverse geocoding is exposed — this is not a generic proxy."""

import logging

import httpx

from app.config import Settings
from app.schemas import ReverseGeocodeResponse

logger = logging.getLogger(__name__)
# httpx logs full request URLs at INFO, and the Geocoding API only accepts the key as a query param.
logging.getLogger("httpx").setLevel(logging.WARNING)

GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"


class GeocodingError(Exception):
    """Carries an HTTP status and a message that is safe to show to clients (never the key or raw URL)."""

    def __init__(self, status_code: int, message: str):
        super().__init__(message)
        self.status_code = status_code
        self.message = message


def _component(components: list[dict], *types: str) -> str | None:
    # Try types in priority order across all components.
    for t in types:
        for c in components:
            if t in c.get("types", []):
                return c.get("long_name")
    return None


def parse_geocode_result(results: list[dict]) -> ReverseGeocodeResponse:
    top = results[0]
    # Finer-grained results (e.g. a street address) sometimes lack sublocality; search them all.
    components = [c for r in results for c in r.get("address_components", [])]
    return ReverseGeocodeResponse(
        formatted_address=top.get("formatted_address", ""),
        locality=_component(components, "sublocality_level_1", "sublocality", "neighborhood", "route"),
        city=_component(components, "locality", "administrative_area_level_3", "administrative_area_level_2"),
        state=_component(components, "administrative_area_level_1"),
        country=_component(components, "country"),
        postal_code=_component(components, "postal_code"),
    )


async def reverse_geocode(lat: float, lng: float, settings: Settings) -> ReverseGeocodeResponse:
    if not settings.has_google_key:
        raise GeocodingError(503, "Location lookup is not configured on the server.")

    params = {
        "latlng": f"{lat},{lng}",
        "key": settings.google_maps_server_api_key.get_secret_value(),  # type: ignore[union-attr]
        "region": "in",
        "language": "en",
    }

    try:
        async with httpx.AsyncClient(timeout=settings.google_timeout_seconds) as client:
            response = await client.get(GEOCODE_URL, params=params)
    except httpx.TimeoutException:
        raise GeocodingError(504, "Location lookup timed out. Please try again.") from None
    except httpx.HTTPError as exc:
        # Log only the exception type: httpx messages can include the request URL (and so the key).
        logger.warning("Geocoding network error: %s", type(exc).__name__)
        raise GeocodingError(502, "Could not reach the location service.") from None

    if response.status_code >= 500:
        raise GeocodingError(502, "The location service is temporarily unavailable.")

    try:
        payload = response.json()
    except ValueError:
        raise GeocodingError(502, "The location service returned an unexpected response.") from None

    status = payload.get("status")
    if status == "OK" and payload.get("results"):
        return parse_geocode_result(payload["results"])
    if status == "ZERO_RESULTS" or status == "OK":
        raise GeocodingError(404, "No address found for this location.")
    if status in ("OVER_QUERY_LIMIT", "OVER_DAILY_LIMIT"):
        raise GeocodingError(429, "Location lookup quota exceeded. Please try again later.")
    if status == "REQUEST_DENIED":
        # error_message from Google can describe key restrictions; keep it in server logs only.
        logger.error("Geocoding request denied — check GOOGLE_MAPS_SERVER_API_KEY and that the Geocoding API is enabled.")
        raise GeocodingError(502, "Location lookup is not authorised. Check the server configuration.")
    if status == "INVALID_REQUEST":
        raise GeocodingError(400, "Invalid coordinates for location lookup.")

    logger.warning("Unexpected geocoding status: %s", status)
    raise GeocodingError(502, "The location service returned an unexpected response.")
