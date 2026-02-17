"""Document routes for ESS Mobile API"""
from fastapi import APIRouter, HTTPException, Depends, Request, Query
from datetime import datetime, timezone

from models_ess.document import (
    DocumentResponse,
    DocumentListResponse,
    DocumentType,
    DocumentStatus,
    DocumentRequirement,
    DocumentRequirementsResponse
)
from routes_ess.auth import get_current_user

router = APIRouter()


# Required documents by default
REQUIRED_DOCUMENTS = [
    {"type": "aadhar", "name": "Aadhar Card", "required": True},
    {"type": "pan", "name": "PAN Card", "required": True},
    {"type": "educational", "name": "Educational Certificates", "required": False},
    {"type": "offer_letter", "name": "Offer Letter", "required": False},
    {"type": "experience_letter", "name": "Previous Experience Letter", "required": False},
]


@router.get("/documents", response_model=DocumentListResponse)
async def get_documents(
    request: Request,
    document_type: str = Query(default=None, description="Filter by document type"),
    current_user: dict = Depends(get_current_user)
):
    """
    Get all documents uploaded by the employee.
    """
    db = request.app.state.db
    user_id = current_user["id"]
    
    query = {"user_id": user_id}
    if document_type:
        query["document_type"] = document_type
    
    docs = await db.employee_documents.find(query, {"_id": 0})\
        .sort("uploaded_at", -1)\
        .to_list(100)
    
    # Get the base URL for generating full document URLs
    import os
    base_url = os.environ.get("API_BASE_URL", "")
    
    documents = []
    for doc in docs:
        # Handle multiple field name variations for file URL
        file_url = doc.get("url") or doc.get("document_url") or doc.get("file_url")
        
        # If file_url is a relative path, prepend base URL
        if file_url and file_url.startswith("/api"):
            file_url = f"{base_url}{file_url}" if base_url else file_url
        
        documents.append(DocumentResponse(
            id=doc["id"],
            document_type=DocumentType(doc.get("document_type", "other")),
            document_name=doc.get("document_name", doc.get("name", "Document")),
            document_number=mask_document_number(doc.get("document_number")),
            uploaded_at=doc.get("uploaded_at", doc.get("created_at", "")),
            status=DocumentStatus(doc.get("status", "pending") if doc.get("verified") is None else ("verified" if doc.get("verified") else "pending")),
            verified_by=doc.get("verified_by_name"),
            verified_at=doc.get("verified_at"),
            rejection_reason=doc.get("rejection_reason"),
            file_url=file_url,
            file_size=doc.get("file_size"),
            mime_type=doc.get("mime_type") or doc.get("content_type")
        ))
    
    return DocumentListResponse(
        documents=documents,
        total=len(documents)
    )


@router.get("/documents/requirements", response_model=DocumentRequirementsResponse)
async def get_document_requirements(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """
    Get document requirements and completion status.
    """
    db = request.app.state.db
    user_id = current_user["id"]
    
    # Get uploaded documents
    uploaded = await db.employee_documents.find(
        {"user_id": user_id},
        {"_id": 0, "document_type": 1, "verified": 1, "status": 1}
    ).to_list(100)
    
    uploaded_types = {}
    for doc in uploaded:
        doc_type = doc.get("document_type", "other")
        status = "verified" if doc.get("verified") else (doc.get("status", "pending"))
        uploaded_types[doc_type] = status
    
    # Build requirements list
    requirements = []
    completed = 0
    total_required = 0
    
    for req in REQUIRED_DOCUMENTS:
        doc_type = req["type"]
        is_uploaded = doc_type in uploaded_types
        status = uploaded_types.get(doc_type)
        
        requirements.append(DocumentRequirement(
            document_type=DocumentType(doc_type),
            document_name=req["name"],
            is_required=req["required"],
            is_uploaded=is_uploaded,
            status=DocumentStatus(status) if status else None
        ))
        
        if req["required"]:
            total_required += 1
            if is_uploaded:
                completed += 1
    
    completion_pct = (completed / total_required * 100) if total_required > 0 else 100
    
    return DocumentRequirementsResponse(
        requirements=requirements,
        completed_count=completed,
        total_required=total_required,
        completion_percentage=round(completion_pct, 1)
    )


@router.get("/documents/{document_id}", response_model=DocumentResponse)
async def get_document(
    request: Request,
    document_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get single document details.
    """
    db = request.app.state.db
    user_id = current_user["id"]
    
    doc = await db.employee_documents.find_one(
        {"id": document_id, "user_id": user_id},
        {"_id": 0}
    )
    
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Handle multiple field name variations for file URL
    file_url = doc.get("url") or doc.get("document_url") or doc.get("file_url")
    
    return DocumentResponse(
        id=doc["id"],
        document_type=DocumentType(doc.get("document_type", "other")),
        document_name=doc.get("document_name", doc.get("name", "Document")),
        document_number=mask_document_number(doc.get("document_number")),
        uploaded_at=doc.get("uploaded_at", doc.get("created_at", "")),
        status=DocumentStatus(doc.get("status", "pending") if doc.get("verified") is None else ("verified" if doc.get("verified") else "pending")),
        verified_by=doc.get("verified_by_name"),
        verified_at=doc.get("verified_at"),
        rejection_reason=doc.get("rejection_reason"),
        file_url=file_url,
        file_size=doc.get("file_size"),
        mime_type=doc.get("mime_type") or doc.get("content_type")
    )


def mask_document_number(number: str) -> str:
    """Mask document number for security"""
    if not number:
        return None
    
    if len(number) <= 4:
        return "****"
    
    # Show last 4 characters
    return "X" * (len(number) - 4) + number[-4:]
