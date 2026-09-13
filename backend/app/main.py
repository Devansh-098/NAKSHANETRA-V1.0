import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.routers import location, parcel, valuation

logger = logging.getLogger("naksha_netra")


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings = get_settings()
    if not settings.has_google_key:
        logger.warning("GOOGLE_MAPS_SERVER_API_KEY is not set — /api/location/reverse-geocode will return 503.")
    yield


app = FastAPI(
    title="NAKSHA NETRA API",
    description="From Parcel to Property Intelligence. Parcel measurement, location lookup and indicative land "
    "valuation.\n\n**Indicative estimate only. Not an official or legal property valuation.**",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    """Return one readable message plus the field-level errors (without echoing the submitted input)."""
    errors = [
        {"field": ".".join(str(p) for p in e["loc"] if p != "body"), "message": e["msg"]} for e in exc.errors()
    ]
    first = errors[0] if errors else {"field": "", "message": "Invalid request"}
    detail = f"{first['field']}: {first['message']}" if first["field"] else first["message"]
    return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, content={"detail": detail, "errors": errors})


@app.get("/health", tags=["Health"], summary="Health check")
def health() -> dict[str, str]:
    return {"status": "healthy"}


app.include_router(parcel.router)
app.include_router(location.router)
app.include_router(valuation.router)
