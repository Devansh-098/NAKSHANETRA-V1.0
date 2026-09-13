"""Indicative valuation engine.

Rates come from a RateRepository. Today that's a demo JSON file; later a PostGIS table, government
circle rates or market comparables can implement the same interface without touching the router.
"""

import json
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Literal, Protocol

from app.schemas import Comparison, ValuationRequest, ValuationResponse

RATES_FILE = Path(__file__).resolve().parent.parent / "data" / "valuation_rates.json"

SIGNIFICANT_PCT = 10.0

ASSESSMENTS: dict[Comparison, str] = {
    "significantly_above": "Asking price appears significantly above the indicative value.",
    "slightly_above": "Asking price is slightly above the indicative value.",
    "close": "Asking price is close to the indicative value.",
    "below": "Asking price appears below the indicative value.",
}


class RateNotFoundError(LookupError):
    pass


@dataclass(frozen=True)
class RateMatch:
    city: str
    locality: str | None
    rate_per_sq_ft: float
    basis: Literal["locality", "city_default"]


class RateRepository(Protocol):
    def find_rate(self, *, city: str | None, locality: str | None, address: str | None) -> RateMatch: ...


# Google often abbreviates street types in formatted addresses ("Rajpur Rd").
ABBREVIATIONS = {"rd": "road", "st": "street", "mkt": "market", "ngr": "nagar"}


def normalize(text: str | None) -> str:
    words = re.sub(r"[^a-z0-9]+", " ", (text or "").lower()).split()
    return " ".join(ABBREVIATIONS.get(w, w) for w in words)


def _contains(haystack: str, needle: str) -> bool:
    return bool(needle) and f" {needle} " in f" {haystack} "


class JsonRateRepository:
    def __init__(self, path: Path = RATES_FILE):
        raw = json.loads(path.read_text(encoding="utf-8"))
        self._cities: dict[str, dict] = {
            normalize(name): data for name, data in raw.items() if not name.startswith("_") and isinstance(data, dict)
        }

    def find_rate(self, *, city: str | None, locality: str | None, address: str | None) -> RateMatch:
        city_text, locality_text, address_text = normalize(city), normalize(locality), normalize(address)

        city_key = next(
            (k for k in self._cities if k == city_text or _contains(city_text, k) or _contains(address_text, k)),
            None,
        )
        if city_key is None:
            label = city or locality or "this location"
            raise RateNotFoundError(f"No indicative rate data is available for {label} yet.")

        data = self._cities[city_key]
        areas: dict[str, float] = {normalize(k): v for k, v in data.get("areas", {}).items()}

        # Longest name first so "sahastradhara road" wins over a shorter overlapping name.
        for area in sorted(areas, key=len, reverse=True):
            if _contains(locality_text, area) or _contains(address_text, area):
                return RateMatch(city=city_key.title(), locality=area.title(), rate_per_sq_ft=areas[area], basis="locality")

        if "default_rate" not in data:
            raise RateNotFoundError(f"No indicative rate data is available for {locality or city_key.title()} yet.")
        return RateMatch(city=city_key.title(), locality=locality, rate_per_sq_ft=data["default_rate"], basis="city_default")


@lru_cache
def get_rate_repository() -> RateRepository:
    return JsonRateRepository()


def classify(percentage_difference: float) -> Comparison:
    if percentage_difference > SIGNIFICANT_PCT:
        return "significantly_above"
    if percentage_difference > 0:
        return "slightly_above"
    if percentage_difference >= -SIGNIFICANT_PCT:
        return "close"
    return "below"


def calculate_valuation(request: ValuationRequest, repository: RateRepository) -> ValuationResponse:
    match = repository.find_rate(city=request.city, locality=request.locality, address=request.address)
    estimated_value = round(request.area_sq_ft * match.rate_per_sq_ft)

    response = ValuationResponse(
        locality=match.locality,
        city=match.city,
        rate_basis=match.basis,
        rate_per_sq_ft=match.rate_per_sq_ft,
        estimated_value=estimated_value,
    )

    if request.asking_price and estimated_value > 0:
        difference = request.asking_price - estimated_value
        pct = round(difference / estimated_value * 100, 2)
        comparison = classify(pct)
        response.asking_price = request.asking_price
        response.difference = round(difference)
        response.percentage_difference = pct
        response.comparison = comparison
        response.assessment = ASSESSMENTS[comparison]

    return response
