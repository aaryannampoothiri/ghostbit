from pydantic import BaseModel, Field


class AnalyzeResponse(BaseModel):
    capacity_bits: int = Field(..., ge=0)
    capacity_bytes: int = Field(..., ge=0)
    eligible_pixels: int = Field(..., ge=0)
    variance_threshold: float
    image_fingerprint: str


class EmbedResponseMeta(BaseModel):
    capacity_bits: int = Field(..., ge=0)
    used_bits: int = Field(..., ge=0)
    usage_percent: float = Field(..., ge=0.0, le=100.0)
    image_fingerprint: str


class ExtractResponse(BaseModel):
    message: str
