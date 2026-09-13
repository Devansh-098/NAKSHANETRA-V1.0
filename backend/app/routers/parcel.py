from fastapi import APIRouter, HTTPException, status

from app.schemas import ErrorResponse, ParcelAnalyzeRequest, ParcelAnalyzeResponse
from app.services.geometry import InvalidGeometryError, analyze_parcel

router = APIRouter(prefix="/api/parcel", tags=["Parcel"])


@router.post(
    "/analyze",
    response_model=ParcelAnalyzeResponse,
    summary="Measure a drawn parcel",
    description="Validates the boundary and computes true ground area by projecting WGS84 coordinates "
    "to a local equal-area projection.",
    responses={422: {"model": ErrorResponse, "description": "Invalid coordinates or parcel geometry"}},
)
def analyze(request: ParcelAnalyzeRequest) -> ParcelAnalyzeResponse:
    try:
        metrics = analyze_parcel(request.coordinates)
    except InvalidGeometryError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc)) from None
    return ParcelAnalyzeResponse(
        area_sq_m=metrics.area_sq_m,
        area_sq_ft=metrics.area_sq_ft,
        area_acres=metrics.area_acres,
        representative_point=metrics.representative_point,
    )
