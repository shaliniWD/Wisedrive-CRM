// Firebase Storage upload service for media files
// Uses streaming upload via signed URLs to avoid memory issues with large files
import * as FileSystem from 'expo-file-system';
import { diagLogger } from './diagLogger';
import { API_BASE } from './api';

export interface UploadProgress {
  progress: number;
  bytesTransferred: number;
  totalBytes: number;
}

export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Upload a file to Firebase Storage using streaming upload
 * This approach:
 * 1. Requests a signed URL from the backend
 * 2. Uses FileSystem.uploadAsync to stream the file directly to Firebase
 * 3. Never loads the entire file into memory - avoids OutOfMemoryError
 */
export async function uploadMediaToFirebase(
  uri: string,
  inspectionId: string,
  questionId: string,
  mediaType: 'image' | 'video',
  onProgress?: (progress: UploadProgress) => void,
  authToken?: string
): Promise<UploadResult> {
  const startTime = Date.now();
  
  diagLogger.info('FIREBASE_STREAMING_UPLOAD_START', {
    inspectionId,
    questionId,
    mediaType,
    uri: uri.substring(0, 50) + '...',
  });

  try {
    // Step 1: Verify file exists
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) {
      throw new Error('File does not exist');
    }

    diagLogger.info('FIREBASE_FILE_EXISTS', { 
      uri: uri.substring(0, 40),
      exists: true
    });

    // Notify initial progress
    if (onProgress) {
      onProgress({ progress: 5, bytesTransferred: 0, totalBytes: 0 });
    }

    // Step 2: Get signed URL from backend
    const extension = mediaType === 'image' ? 'jpg' : 'mp4';
    const contentType = mediaType === 'image' ? 'image/jpeg' : 'video/mp4';
    const filename = `${questionId}_${Date.now()}.${extension}`;

    diagLogger.info('FIREBASE_REQUESTING_SIGNED_URL', { 
      filename, 
      contentType,
      apiBase: API_BASE
    });

    const signedUrlResponse = await fetch(`${API_BASE}/api/media/generate-upload-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        filename,
        content_type: contentType,
        inspection_id: inspectionId,
        question_id: questionId,
      }),
    });

    if (!signedUrlResponse.ok) {
      const errorText = await signedUrlResponse.text();
      diagLogger.error('FIREBASE_SIGNED_URL_FAILED', { 
        status: signedUrlResponse.status, 
        error: errorText 
      });
      throw new Error(`Failed to get upload URL: ${signedUrlResponse.status} - ${errorText}`);
    }

    const { signed_url, firebase_path } = await signedUrlResponse.json();
    
    diagLogger.info('FIREBASE_SIGNED_URL_RECEIVED', { 
      firebase_path,
      urlLength: signed_url?.length || 0
    });

    if (onProgress) {
      onProgress({ progress: 15, bytesTransferred: 0, totalBytes: 0 });
    }

    // Step 3: Stream upload the file directly using FileSystem.uploadAsync
    // This is the key - it streams from disk, never loads into memory
    diagLogger.info('FIREBASE_STREAMING_UPLOAD_STARTING', { 
      uri: uri.substring(0, 50),
      contentType
    });

    const uploadStartTime = Date.now();
    
    // Use uploadAsync with PUT method to the signed URL
    // This streams the file directly from the filesystem
    const uploadResult = await FileSystem.uploadAsync(signed_url, uri, {
      httpMethod: 'PUT',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: {
        'Content-Type': contentType,
      },
    });

    const uploadDuration = Date.now() - uploadStartTime;
    
    diagLogger.info('FIREBASE_UPLOAD_RESPONSE', { 
      status: uploadResult.status,
      uploadDurationMs: uploadDuration,
      responseBodyLength: uploadResult.body?.length || 0
    });

    // Check if upload was successful (200 or 201)
    if (uploadResult.status >= 200 && uploadResult.status < 300) {
      const totalDuration = Date.now() - startTime;
      
      diagLogger.info('FIREBASE_STREAMING_UPLOAD_SUCCESS', {
        firebase_path,
        totalDurationMs: totalDuration,
        uploadDurationMs: uploadDuration,
      });

      if (onProgress) {
        onProgress({ progress: 100, bytesTransferred: 0, totalBytes: 0 });
      }

      // Return the gs:// URL - the backend will store this
      return { 
        success: true, 
        url: firebase_path 
      };
    } else {
      diagLogger.error('FIREBASE_UPLOAD_HTTP_ERROR', {
        status: uploadResult.status,
        body: uploadResult.body?.substring(0, 500)
      });
      throw new Error(`Upload failed with status ${uploadResult.status}: ${uploadResult.body?.substring(0, 200)}`);
    }

  } catch (error: any) {
    const duration = Date.now() - startTime;
    diagLogger.error('FIREBASE_STREAMING_UPLOAD_FAILED', {
      error: error.message,
      stack: error.stack?.substring(0, 300),
      durationMs: duration,
    });
    return { success: false, error: `Upload error: ${error.message}` };
  }
}

/**
 * Upload with automatic retry on failure
 * Uses exponential backoff: 1s, 2s, 4s delays between retries
 */
export async function uploadMediaWithRetry(
  uri: string,
  inspectionId: string,
  questionId: string,
  mediaType: 'image' | 'video',
  onProgress?: (progress: UploadProgress) => void,
  authToken?: string,
  maxRetries: number = 3
): Promise<UploadResult> {
  let lastError: string = '';
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    diagLogger.info('FIREBASE_UPLOAD_ATTEMPT', {
      attempt,
      maxRetries,
      questionId,
      mediaType,
    });
    
    const result = await uploadMediaToFirebase(
      uri,
      inspectionId,
      questionId,
      mediaType,
      onProgress,
      authToken
    );
    
    if (result.success) {
      if (attempt > 1) {
        diagLogger.info('FIREBASE_UPLOAD_RETRY_SUCCESS', {
          questionId,
          attemptsTaken: attempt,
        });
      }
      return result;
    }
    
    lastError = result.error || 'Unknown error';
    
    // Don't retry on certain errors
    if (lastError.includes('File does not exist') || 
        lastError.includes('401') || 
        lastError.includes('403')) {
      diagLogger.warn('FIREBASE_UPLOAD_NO_RETRY', {
        questionId,
        reason: 'Non-retryable error',
        error: lastError,
      });
      return result;
    }
    
    // Wait before retry with exponential backoff
    if (attempt < maxRetries) {
      const delayMs = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
      diagLogger.info('FIREBASE_UPLOAD_RETRY_WAIT', {
        questionId,
        attempt,
        delayMs,
        error: lastError,
      });
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  diagLogger.error('FIREBASE_UPLOAD_ALL_RETRIES_FAILED', {
    questionId,
    attempts: maxRetries,
    lastError,
  });
  
  return { success: false, error: `Upload failed after ${maxRetries} attempts: ${lastError}` };
}

/**
 * Upload multiple media files sequentially
 */
export async function uploadMultipleMedia(
  files: Array<{
    uri: string;
    inspectionId: string;
    questionId: string;
    mediaType: 'image' | 'video';
  }>,
  authToken?: string,
  onProgress?: (index: number, progress: UploadProgress) => void
): Promise<Array<UploadResult & { questionId: string }>> {
  const results: Array<UploadResult & { questionId: string }> = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    // Use retry mechanism for each file
    const result = await uploadMediaWithRetry(
      file.uri,
      file.inspectionId,
      file.questionId,
      file.mediaType,
      onProgress ? (p) => onProgress(i, p) : undefined,
      authToken,
      3 // 3 retries
    );
    results.push({ ...result, questionId: file.questionId });
  }

  return results;
}

export { uploadMediaToFirebase };
export default uploadMediaWithRetry;
