from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

from .schemas import AnalyzeResponse, ExtractResponse
from .stego import analyze_capacity, embed_message, extract_message


app = FastAPI(title="GhostBit API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/analyze", response_model=AnalyzeResponse)
async def analyze(file: UploadFile = File(...)) -> AnalyzeResponse:
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        result = analyze_capacity(file_bytes)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Unable to analyze image: {exc}") from exc

    return AnalyzeResponse(
        capacity_bits=result.capacity_bits,
        capacity_bytes=result.capacity_bytes,
        eligible_pixels=result.eligible_pixels,
        variance_threshold=result.variance_threshold,
        image_fingerprint=result.image_fingerprint,
    )


@app.post("/api/embed")
async def embed(
    file: UploadFile = File(...),
    message: str = Form(...),
    key: str = Form(...),
) -> StreamingResponse:
    if not key.strip():
        raise HTTPException(status_code=400, detail="Secret key is required.")
    if not message:
        raise HTTPException(status_code=400, detail="Secret message is required.")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        result = embed_message(file_bytes, message, key)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Embedding failed: {exc}") from exc

    headers = {
        "Content-Disposition": 'attachment; filename="ghostbit-stego.png"',
        "X-GhostBit-Capacity-Bits": str(result.capacity_bits),
        "X-GhostBit-Used-Bits": str(result.used_bits),
        "X-GhostBit-Usage-Percent": f"{result.usage_percent:.2f}",
        "X-GhostBit-Image-Fingerprint": result.image_fingerprint,
    }
    return StreamingResponse(iter([result.png_bytes]), media_type="image/png", headers=headers)


@app.post("/api/extract", response_model=ExtractResponse)
async def extract(file: UploadFile = File(...), key: str = Form(...)) -> JSONResponse:
    if not key.strip():
        raise HTTPException(status_code=400, detail="Secret key is required.")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        message = extract_message(file_bytes, key)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Extraction failed: {exc}") from exc

    return JSONResponse(content=ExtractResponse(message=message).model_dump())
