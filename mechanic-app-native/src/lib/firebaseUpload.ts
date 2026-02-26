// Firebase Storage upload service for media files
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

    // Fetch the file as blob
    const response = await fetch(uri);
    const blob = await response.blob();
    
    const fileSizeMB = blob.size / (1024 * 1024);
    diagLogger.info('FIREBASE_FILE_SIZE', { 
      sizeMB: fileSizeMB.toFixed(2),
      sizeBytes: blob.size 
    });

    // Create storage reference
    const storageRef = ref(storage, storagePath);

    // Upload with progress tracking
    return new Promise((resolve) => {
      const uploadTask = uploadBytesResumable(storageRef, blob);

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
          
          // Log progress at 25%, 50%, 75%, 100%
          if (progress > 0 && progress % 25 < 5) {
            diagLogger.info('FIREBASE_UPLOAD_PROGRESS', {
              progress: Math.round(progress),
              transferred: `${(snapshot.bytesTransferred / 1024 / 1024).toFixed(1)}MB`,
            });
          }
        },
        (error) => {
          const duration = Date.now() - startTime;
          diagLogger.error('FIREBASE_UPLOAD_ERROR', {
            error: error.message,
            code: error.code,
            durationMs: duration,
          });
          resolve({
            success: false,
            error: `Upload failed: ${error.message}`,
          });
        },
        async () => {
          // Upload completed successfully
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            const duration = Date.now() - startTime;
            
            diagLogger.info('FIREBASE_UPLOAD_SUCCESS', {
              durationMs: duration,
              sizeMB: fileSizeMB.toFixed(2),
              url: downloadURL.substring(0, 80) + '...',
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
 * Upload multiple files in parallel
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

  const results = await Promise.all(
    files.map(async (file, index) => {
      const result = await uploadMediaToFirebase(
        file.uri,
        file.inspectionId,
        file.questionId,
        file.mediaType,
        onProgress ? (p) => onProgress(index, p) : undefined
      );
      return { ...result, questionId: file.questionId };
    })
  );

  const successCount = results.filter((r) => r.success).length;
  diagLogger.info('FIREBASE_BATCH_UPLOAD_COMPLETE', {
    total: files.length,
    succeeded: successCount,
    failed: files.length - successCount,
  });

  return results;
}

export default uploadMediaToFirebase;
