import json

from fastapi import APIRouter, Body, File, HTTPException, Request, UploadFile

from wcp_backend.models.schemas import ExtractedWCP
from wcp_backend.pipeline.extraction import extract_from_text, extract_from_pdf

router = APIRouter()


@router.post("", response_model=ExtractedWCP)
async def extract_wcp(
    request: Request,
    text: str | None = Body(None),
    file: UploadFile | None = File(None),
) -> ExtractedWCP:
    """Extract structured WCP data from text or PDF bytes."""
    try:
        if file:
            content = await file.read()
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
            if isinstance(parsed_body, dict) and isinstance(parsed_body.get("text"), str):
                return extract_from_text(parsed_body["text"])
        raise HTTPException(status_code=400, detail="Provide 'text' or 'file'")
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=400, detail=f"Extraction failed: {str(e)}")
