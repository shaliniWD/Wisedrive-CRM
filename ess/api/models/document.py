"""Document models for ESS Mobile API"""
from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum


class DocumentType(str, Enum):
    AADHAR = "aadhar"
    PAN = "pan"
    PASSPORT = "passport"
    DRIVING_LICENSE = "driving_license"
    VOTER_ID = "voter_id"
    OFFER_LETTER = "offer_letter"
    EXPERIENCE_LETTER = "experience_letter"
    SALARY_SLIP = "salary_slip"
    RELIEVING_LETTER = "relieving_letter"
    EDUCATIONAL = "educational"
    OTHER = "other"


class DocumentStatus(str, Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"


class DocumentResponse(BaseModel):
    """Single document response"""
    id: str
    document_type: DocumentType
    document_name: str
    document_number: Optional[str]  # Masked for sensitive docs
    uploaded_at: str
    status: DocumentStatus
    verified_by: Optional[str]
    verified_at: Optional[str]
    rejection_reason: Optional[str]
    file_url: Optional[str]  # Temporary signed URL
    file_size: Optional[int]
    mime_type: Optional[str]
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "doc-123",
                "document_type": "aadhar",
                "document_name": "Aadhar Card",
                "document_number": "XXXX XXXX 1234",
                "uploaded_at": "2024-06-15T10:30:00Z",
                "status": "verified",
                "verified_by": "HR Manager",
                "verified_at": "2024-06-16T09:00:00Z"
            }
        }


class DocumentListResponse(BaseModel):
    """List of employee documents"""
    documents: List[DocumentResponse]
    total: int


class DocumentUploadRequest(BaseModel):
    """Request to get upload URL"""
    document_type: DocumentType
    document_name: str
    document_number: Optional[str]
    file_name: str
    file_size: int
    mime_type: str


class DocumentUploadResponse(BaseModel):
    """Upload URL response"""
    upload_url: str
    document_id: str
    expires_in: int  # seconds


class DocumentRequirement(BaseModel):
    """Document requirement status"""
    document_type: DocumentType
    document_name: str
    is_required: bool
    is_uploaded: bool
    status: Optional[DocumentStatus]


class DocumentRequirementsResponse(BaseModel):
    """All document requirements for employee"""
    requirements: List[DocumentRequirement]
    completed_count: int
    total_required: int
    completion_percentage: float
