from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.schemas import ErrorResponse, ValuationRequest, ValuationResponse
from app.services.valuation import RateNotFoundError, RateRepository, calculate_valuation, get_rate_repository

router = APIRouter(prefix="/api/valuation", tags=["Valuation"])


@router.post(
    "/calculate",
    response_model=ValuationResponse,
    summary="Calculate an Indicative Land Value",
    description="Applies a demo indicative rate for the locality (or the city default) and compares it with the "
    "seller's asking price. Indicative estimate only. Not an official or legal property valuation.",
    responses={404: {"model": ErrorResponse, "description": "No rate data for this city"}},
)
def calculate(
    request: ValuationRequest, repository: Annotated[RateRepository, Depends(get_rate_repository)]
) -> ValuationResponse:
    try:
        return calculate_valuation(request, repository)
    except RateNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from None
