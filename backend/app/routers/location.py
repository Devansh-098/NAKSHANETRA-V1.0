from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.config import Settings, get_settings
from app.schemas import ErrorResponse, ReverseGeocodeRequest, ReverseGeocodeResponse
from app.services.google_maps import GeocodingError, reverse_geocode

router = APIRouter(prefix="/api/location", tags=["Location"])


@router.post(
    "/reverse-geocode",
    response_model=ReverseGeocodeResponse,
    summary="Find the address and locality for a point",
    description="Uses the server-side Google Geocoding API. The API key never leaves the server.",
    responses={
        404: {"model": ErrorResponse, "description": "No address found"},
        429: {"model": ErrorResponse, "description": "Google quota exceeded"},
        502: {"model": ErrorResponse, "description": "Google API failure"},
        503: {"model": ErrorResponse, "description": "Server key not configured"},
        504: {"model": ErrorResponse, "description": "Google API timeout"},
    },
)
async def reverse_geocode_point(
    request: ReverseGeocodeRequest, settings: Annotated[Settings, Depends(get_settings)]
) -> ReverseGeocodeResponse:
    try:
        return await reverse_geocode(request.lat, request.lng, settings)
    except GeocodingError as exc:
        raise HTTPException(exc.status_code, exc.message) from None
