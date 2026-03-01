"""Storage Service - Abstract storage for payslips and documents"""
from typing import Optional
import os
from datetime import datetime, timezone, timedelta
from abc import ABC, abstractmethod


class StorageService(ABC):
    """Abstract base class for storage operations"""
    
    @abstractmethod
    async def upload_payslip(self, file_bytes: bytes, filename: str, year: int, month: int) -> str:
        """Upload payslip PDF and return path/URL"""
        pass
    
    @abstractmethod
    async def get_download_url(self, path: str, expires_in: int = 900) -> str:
        """Get signed download URL (default 15 min expiry)"""
        pass
    
    @abstractmethod
    async def delete_file(self, path: str) -> bool:
        """Delete a file"""
        pass


class LocalStorageService(StorageService):
    """Local file storage for development"""
    
    def __init__(self, base_path: str = "/app/storage"):
        self.base_path = base_path
    
    async def upload_payslip(self, file_bytes: bytes, filename: str, year: int, month: int) -> str:
        """Save payslip to local filesystem"""
        dir_path = f"{self.base_path}/payslips/{year}/{str(month).zfill(2)}"
        os.makedirs(dir_path, exist_ok=True)
        
        file_path = f"{dir_path}/{filename}"
        
        with open(file_path, 'wb') as f:
            f.write(file_bytes)
        
        return file_path
    
    async def get_download_url(self, path: str, expires_in: int = 900) -> str:
        """For local storage, just return the path"""
        return path
    
    async def get_signed_upload_url(self, key: str, content_type: str, expires_in: int = 3600) -> dict:
        """For local storage, return a direct upload endpoint"""
        # Create directory structure if needed
        full_path = f"{self.base_path}/{key}"
        dir_path = os.path.dirname(full_path)
        os.makedirs(dir_path, exist_ok=True)
        
        # Use the preview URL for external access
        # This will be set by server.py when initializing
        return {
            "upload_url": "/api/media/upload-direct",  # Relative path - frontend will prepend backend URL
            "file_path": full_path,
            "key": key,
            "fields": {
                "key": key,
                "content_type": content_type
            }
        }
    
    async def upload_direct(self, key: str, file_bytes: bytes) -> str:
        """Direct upload for local storage"""
        full_path = f"{self.base_path}/{key}"
        dir_path = os.path.dirname(full_path)
        os.makedirs(dir_path, exist_ok=True)
        
        with open(full_path, 'wb') as f:
            f.write(file_bytes)
        
        return full_path
    
    async def delete_file(self, path: str) -> bool:
        """Delete local file"""
        try:
            if os.path.exists(path):
                os.remove(path)
                return True
            return False
        except Exception:
            return False


class S3StorageService(StorageService):
    """S3-compatible object storage for TEST/PROD environments"""
    
    def __init__(
        self,
        bucket_name: str,
        endpoint_url: Optional[str] = None,
        access_key: Optional[str] = None,
        secret_key: Optional[str] = None,
        region: str = "ap-south-1"
    ):
        import boto3
        from botocore.config import Config
        
        self.bucket_name = bucket_name
        self.region = region
        
        config = Config(
            signature_version='s3v4',
            region_name=region
        )
        
        session_kwargs = {}
        if access_key and secret_key:
            session_kwargs['aws_access_key_id'] = access_key
            session_kwargs['aws_secret_access_key'] = secret_key
        
        client_kwargs = {'config': config}
        if endpoint_url:
            client_kwargs['endpoint_url'] = endpoint_url
        
        self.s3_client = boto3.client('s3', **client_kwargs, **session_kwargs)
    
    async def upload_payslip(self, file_bytes: bytes, filename: str, year: int, month: int) -> str:
        """Upload payslip to S3 bucket"""
        import io
        
        key = f"payslips/{year}/{str(month).zfill(2)}/{filename}"
        
        self.s3_client.upload_fileobj(
            io.BytesIO(file_bytes),
            self.bucket_name,
            key,
            ExtraArgs={
                'ContentType': 'application/pdf',
                'ServerSideEncryption': 'AES256'
            }
        )
        
        return f"s3://{self.bucket_name}/{key}"
    
    async def get_download_url(self, path: str, expires_in: int = 900) -> str:
        """Generate presigned URL for download"""
        # Parse S3 path
        if path.startswith("s3://"):
            path = path[5:]
            bucket, key = path.split("/", 1)
        else:
            # Assume path is just the key
            bucket = self.bucket_name
            key = path
        
        url = self.s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': bucket, 'Key': key},
            ExpiresIn=expires_in
        )
        
        return url
    
    async def delete_file(self, path: str) -> bool:
        """Delete file from S3"""
        try:
            if path.startswith("s3://"):
                path = path[5:]
                bucket, key = path.split("/", 1)
            else:
                bucket = self.bucket_name
                key = path
            
            self.s3_client.delete_object(Bucket=bucket, Key=key)
            return True
        except Exception:
            return False


def get_storage_service() -> StorageService:
    """Factory function to get appropriate storage service based on environment"""
    storage_type = os.environ.get('STORAGE_TYPE', 'local')
    
    if storage_type == 's3':
        return S3StorageService(
            bucket_name=os.environ.get('S3_BUCKET_NAME', 'wisedrive-assets'),
            endpoint_url=os.environ.get('S3_ENDPOINT_URL'),
            access_key=os.environ.get('S3_ACCESS_KEY'),
            secret_key=os.environ.get('S3_SECRET_KEY'),
            region=os.environ.get('S3_REGION', 'ap-south-1')
        )
    else:
        return LocalStorageService()
