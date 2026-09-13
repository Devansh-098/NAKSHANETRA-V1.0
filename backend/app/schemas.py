from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

DISCLAIMER = "Indicative estimate only. Not an official or legal property valuation."


class Coordinate(BaseModel):
    """A WGS84 point (EPSG:4326)."""

    model_config = ConfigDict(allow_inf_nan=False, json_schema_extra={"example": {"lat": 30.3165, "lng": 78.0322}})

    lat: float = Field(ge=-90, le=90, description="Latitude in decimal degrees")
    lng: float = Field(ge=-180, le=180, description="Longitude in decimal degrees")


class ErrorResponse(BaseModel):
    detail: str


# ---------- Parcel ----------


class ParcelAnalyzeRequest(BaseModel):
    coordinates: list[Coordinate] = Field(
        min_length=3,
        max_length=1000,
        description="Parcel boundary vertices in order. The closing vertex may be repeated or omitted.",
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "coordinates": [
                    {"lat": 30.3165, "lng": 78.0322},
                    {"lat": 30.3170, "lng": 78.0330},
                    {"lat": 30.3162, "lng": 78.0340},
                    {"lat": 30.3158, "lng": 78.0330},
                ]
            }
        }
    )


class ParcelAnalyzeResponse(BaseModel):
    area_sq_m: float
    area_sq_ft: float
    area_acres: float
    representative_point: Coordinate = Field(
        description="A point guaranteed to lie inside the parcel (the centroid when it does). Use it for location lookup."
    )


# ---------- Location ----------


class ReverseGeocodeRequest(Coordinate):
    pass


class ReverseGeocodeResponse(BaseModel):
    formatted_address: str
    locality: str | None = None
    city: str | None = None
    state: str | None = None
    country: str | None = None
    postal_code: str | None = None


# ---------- Valuation ----------

Comparison = Literal["significantly_above", "slightly_above", "close", "below"]


class ValuationRequest(BaseModel):
    model_config = ConfigDict(
        allow_inf_nan=False,
        json_schema_extra={
            "example": {"area_sq_ft": 2450, "locality": "Rajpur Road", "city": "Dehradun", "asking_price": 7000000}
        },
    )

    area_sq_ft: float = Field(gt=0, le=1e9, description="Parcel area in square feet")
    locality: str | None = Field(default=None, max_length=200, description="Neighbourhood / sub-locality")
    city: str | None = Field(default=None, max_length=200)
    address: str | None = Field(
        default=None, max_length=500, description="Optional full address, used as an extra hint when matching localities"
    )
    asking_price: float | None = Field(default=None, ge=0, le=1e13, description="Seller asking price in INR")


class ValuationResponse(BaseModel):
    locality: str | None = Field(description="The locality whose rate was applied, or the input locality for a city default")
    city: str
    rate_basis: Literal["locality", "city_default"]
    rate_per_sq_ft: float
    estimated_value: float
    asking_price: float | None = None
    difference: float | None = None
    percentage_difference: float | None = None
    comparison: Comparison | None = None
    assessment: str | None = None
    label: str = "Indicative Land Value"
    is_demo_data: bool = True
    disclaimer: str = DISCLAIMER
