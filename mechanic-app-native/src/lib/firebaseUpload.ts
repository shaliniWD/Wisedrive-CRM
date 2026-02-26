// Firebase Storage upload service for media files
// Uses blob approach compatible with React Native
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';
import { diagLogger } from './diagLogger';

export interface UploadProgress {
  progress: number;  // 0-100
  bytesTransferred: number;
  totalBytes: number;
}

export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Convert file URI to Blob using XMLHttpRequest (more reliable in React Native)
 */
async function uriToBlob(uri: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = function () {
      resolve(xhr.response);
    };
    xhr.onerror = function () {
      reject(new Error('Failed to convert URI to Blob'));
    };
    xhr.responseType = 'blob';
    xhr.open('GET', uri, true);
    xhr.send(null);
  });
}

/**
 * Upload a file to Firebase Storage
 * @param uri - Local file URI (file://...)
 * @param inspectionId - Inspection ID for folder organization
 * @param questionId - Question ID for file naming
 * @param mediaType - 'image' or 'video'
 * @param onProgress - Optional progress callback
 */
export async function uploadMediaToFirebase(
  uri: string,
  inspectionId: string,
  questionId: string,
  mediaType: 'image' | 'video',
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
  const startTime = Date.now();
  
  diagLogger.info('FIREBASE_UPLOAD_START', {
    inspectionId,
    questionId,
    mediaType,
    uri: uri.substring(0, 50) + '...',
  });

  try {
    // Create a unique filename
    const timestamp = Date.now();
    const extension = mediaType === 'image' ? 'jpg' : 'mp4';
    const filename = `${questionId}_${timestamp}.${extension}`;
    const storagePath = `inspections/${inspectionId}/${filename}`;

    diagLogger.info('FIREBASE_UPLOAD_PATH', { storagePath });

    // Convert URI to Blob using XMLHttpRequest (works better in React Native)
    diagLogger.info('FIREBASE_CONVERTING_TO_BLOB', { uri: uri.substring(0, 30) });
    
    let blob: Blob;
    try {
      blob = await uriToBlob(uri);
    } catch (blobError: any) {
      diagLogger.error('FIREBASE_BLOB_CONVERSION_FAILED', { error: blobError.message });
      throw new Error(`Failed to read file: ${blobError.message}`);
    }
    
    const fileSizeMB = blob.size / (1024 * 1024);
    diagLogger.info('FIREBASE_FILE_SIZE', { 
      sizeMB: fileSizeMB.toFixed(2),
      sizeBytes: blob.size,
      blobType: blob.type,
    });

    // Create storage reference
    const storageRef = ref(storage, storagePath);

    // Set content type based on media type
    const metadata = {
      contentType: mediaType === 'image' ? 'image/jpeg' : 'video/mp4',
    };

    // Upload with progress tracking
    return new Promise((resolve) => {
      diagLogger.info('FIREBASE_STARTING_UPLOAD', { sizeMB: fileSizeMB.toFixed(2) });
      
      const uploadTask = uploadBytesResumable(storageRef, blob, metadata);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          
          if (onProgress) {
            onProgress({
              progress: Math.round(progress),
              bytesTransferred: snapshot.bytesTransferred,
              totalBytes: snapshot.totalBytes,
            });
          }
          
          // Log progress at key milestones
          const progressInt = Math.round(progress);
          if (progressInt === 25 || progressInt === 50 || progressInt === 75 || progressInt === 100) {
            diagLogger.info('FIREBASE_UPLOAD_PROGRESS', {
              progress: progressInt,
              transferred: `${(snapshot.bytesTransferred / 1024 / 1024).toFixed(1)}MB`,
              total: `${(snapshot.totalBytes / 1024 / 1024).toFixed(1)}MB`,
              state: snapshot.state,
            });
          }
        },
        (error) => {
          const duration = Date.now() - startTime;
          diagLogger.error('FIREBASE_UPLOAD_ERROR', {
            error: error.message,
            code: error.code,
            durationMs: duration,
            serverResponse: error.serverResponse,
          });
          resolve({
            success: false,
            error: `Upload failed: ${error.code} - ${error.message}`,
          });
        },
        async () => {
          // Upload completed successfully
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            const duration = Date.now() - startTime;
            
            diagLogger.info('FIREBASE_UPLOAD_SUCCESS', {
              durationMs: duration,
              durationSec: (duration / 1000).toFixed(1),
              sizeMB: fileSizeMB.toFixed(2),
              url: downloadURL.substring(0, 100) + '...',
            });
            
            resolve({
              success: true,
              url: downloadURL,
            });
          } catch (urlError: any) {
            diagLogger.error('FIREBASE_GET_URL_ERROR', {
              error: urlError.message,
            });
            resolve({
              success: false,
              error: `Failed to get download URL: ${urlError.message}`,
            });
          }
        }
      );
    });
  } catch (error: any) {
    const duration = Date.now() - startTime;
    diagLogger.error('FIREBASE_UPLOAD_FAILED', {
      error: error.message,
      durationMs: duration,
    });
    return {
      success: false,
      error: `Upload error: ${error.message}`,
    };
  }
}

/**
 * Upload multiple files in sequence (to avoid overwhelming the network)
 */
export async function uploadMultipleMedia(
  files: Array<{
    uri: string;
    inspectionId: string;
    questionId: string;
    mediaType: 'image' | 'video';
  }>,
  onProgress?: (index: number, progress: UploadProgress) => void
): Promise<Array<UploadResult & { questionId: string }>> {
  diagLogger.info('FIREBASE_BATCH_UPLOAD_START', {
    totalFiles: files.length,
  });

  const results: Array<UploadResult & { questionId: string }> = [];

  // Upload one at a time to avoid network congestion
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    diagLogger.info('FIREBASE_BATCH_ITEM', { index: i + 1, total: files.length, questionId: file.questionId });
    
    const result = await uploadMediaToFirebase(
      file.uri,
      file.inspectionId,
      file.questionId,
      file.mediaType,
      onProgress ? (p) => onProgress(i, p) : undefined
    );
    results.push({ ...result, questionId: file.questionId });
  }

  const successCount = results.filter((r) => r.success).length;
  diagLogger.info('FIREBASE_BATCH_UPLOAD_COMPLETE', {
    total: files.length,
    succeeded: successCount,
    failed: files.length - successCount,
  });

  return results;
}

export default uploadMediaToFirebase;
