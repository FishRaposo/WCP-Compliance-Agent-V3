import json
import logging

from fastapi import APIRouter, Body, File, HTTPException, Request, UploadFile

from wcp_backend.models.schemas import ExtractedWCP
from wcp_backend.pipeline.extraction import extract_from_pdf, extract_from_text

logger = logging.getLogger(__name__)
router = APIRouter()

MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_CONTENT_TYPES = {"application/pdf", "application/x-pdf"}


@router.post("", response_model=ExtractedWCP)
async def extract_wcp(
    request: Request,
    text: str | None = Body(None),
    file: UploadFile | None = File(None),
) -> ExtractedWCP:
    """Extract structured WCP data from text or PDF bytes."""
    if text and file:
        raise HTTPException(
            status_code=400, detail="Provide either 'text' or 'file', not both"
        )

    try:
        if file:
            if file.content_type and file.content_type not in ALLOWED_CONTENT_TYPES:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid file type: {file.content_type}. Only PDF is supported",
                )
            content = await file.read()
            if len(content) > MAX_UPLOAD_SIZE:
                raise HTTPException(
                    status_code=413,
                    detail=f"File too large: {len(content)} bytes. Max: {MAX_UPLOAD_SIZE}",
                )
            return extract_from_pdf(content)
        if text:
            return extract_from_text(text)
        raw_body = await request.body()
        if raw_body:
            raw_text = raw_body.decode("utf-8")
            try:
                parsed_body = json.loads(raw_text)
            except json.JSONDecodeError:
                parsed_body = raw_text
            if isinstance(parsed_body, str):
                return extract_from_text(parsed_body)
            if isinstance(parsed_body, dict) and isinstance(
                parsed_body.get("text"), str
            ):
                return extract_from_text(parsed_body["text"])
        raise HTTPException(status_code=400, detail="Provide 'text' or 'file'")
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Extraction failed")
        raise HTTPException(
            status_code=400, detail=f"Extraction failed: {type(e).__name__}"
        )
