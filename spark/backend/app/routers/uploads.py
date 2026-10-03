"""Uploads router: stage file attachments before claim submission.

Files are stored on disk under the `uploads/` directory at the project root.
Each upload returns a reference ID that callers include in the claim's
`attachments` list field.

Supported categories: photos, controller_log, bms_log (open-ended).
"""
from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

_UPLOADS_DIR = Path(__file__).parents[3] / "uploads"
_UPLOADS_DIR.mkdir(exist_ok=True)

router = APIRouter(prefix="/uploads", tags=["uploads"])

_MAX_SIZE = 100 * 1024 * 1024  # 100 MB hard limit


@router.post("")
async def upload_file(
    file: UploadFile = File(...),
    category: str = Form(default="general"),
) -> dict:
    content = await file.read()
    if len(content) > _MAX_SIZE:
        raise HTTPException(status_code=413, detail="File exceeds 100 MB limit")

    file_id = str(uuid.uuid4())
    safe_name = Path(file.filename or "upload").name  # strip any path traversal
    dest = _UPLOADS_DIR / f"{file_id}_{safe_name}"
    dest.write_bytes(content)

    return {
        "id": file_id,
        "filename": safe_name,
        "content_type": file.content_type or "application/octet-stream",
        "size": len(content),
        "category": category,
        "url": f"/uploads/{file_id}",
    }


@router.get("/{file_id}")
def serve_file(file_id: str) -> FileResponse:
    # Security: file_id must be a UUID; no path traversal possible
    try:
        uuid.UUID(file_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid file ID")

    matches = list(_UPLOADS_DIR.glob(f"{file_id}_*"))
    if not matches:
        raise HTTPException(status_code=404, detail="File not found")

    path = matches[0]
    return FileResponse(path=str(path), filename=path.name.split("_", 1)[-1])
