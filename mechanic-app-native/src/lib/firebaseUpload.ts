// Firebase Storage upload service for media files
// Uses chunked approach for large files to avoid memory issues
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import * as FileSystem from 'expo-file-system';
import { storage } from './firebase';
import { diagLogger } from './diagLogger';

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

// Threshold for using chunked upload (10MB)
const CHUNK_THRESHOLD = 10 * 1024 * 1024;
// Chunk size for reading (5MB)
const CHUNK_SIZE = 5 * 1024 * 1024;

/**
 * Upload a file to Firebase Storage
 * For large files (>10MB), uses chunked reading to avoid memory issues
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
    // Create unique filename
    const timestamp = Date.now();
    const extension = mediaType === 'image' ? 'jpg' : 'mp4';
    const filename = `${questionId}_${timestamp}.${extension}`;
    const storagePath = `inspections/${inspectionId}/${filename}`;

    diagLogger.info('FIREBASE_UPLOAD_PATH', { storagePath });

    // Get file info
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) {
      throw new Error('File does not exist');
    }

    // For Expo SDK 52+, size might not be available, estimate from reading
    let fileSize = 0;
    
    diagLogger.info('FIREBASE_FILE_INFO', { 
      exists: fileInfo.exists,
      uri: fileInfo.uri?.substring(0, 40),
    });

    // Notify progress
    if (onProgress) {
      onProgress({ progress: 5, bytesTransferred: 0, totalBytes: 0 });
    }

    // Read file in chunks to avoid memory issues
    diagLogger.info('FIREBASE_READING_CHUNKED', {});
    const readStart = Date.now();
    
    const chunks: Uint8Array[] = [];
    let position = 0;
    let totalBytesRead = 0;
    let chunkIndex = 0;
    
    while (true) {
      chunkIndex++;
      diagLogger.info('FIREBASE_READING_CHUNK', { 
        chunk: chunkIndex, 
        position,
        chunkSize: CHUNK_SIZE 
      });
      
      try {
        // Read a chunk as base64
        const chunkBase64 = await FileSystem.readAsStringAsync(uri, {
          encoding: 'base64',
          position: position,
          length: CHUNK_SIZE,
        });
        
        if (!chunkBase64 || chunkBase64.length === 0) {
          diagLogger.info('FIREBASE_CHUNK_EMPTY', { chunk: chunkIndex });
          break;
        }
        
        // Convert base64 to Uint8Array
        const binaryString = atob(chunkBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        chunks.push(bytes);
        totalBytesRead += bytes.length;
        position += CHUNK_SIZE;
        
        diagLogger.info('FIREBASE_CHUNK_READ', { 
          chunk: chunkIndex, 
          chunkBytes: bytes.length,
          totalBytes: totalBytesRead,
          totalMB: (totalBytesRead / 1024 / 1024).toFixed(2),
        });
        
        // Update progress
        if (onProgress) {
          onProgress({ 
            progress: Math.min(40, 5 + chunkIndex * 5), 
            bytesTransferred: totalBytesRead, 
            totalBytes: totalBytesRead 
          });
        }
        
        // If we read less than chunk size, we're done
        if (bytes.length < CHUNK_SIZE) {
          break;
        }
        
      } catch (chunkError: any) {
        // If position is out of bounds, we've read everything
        if (chunkError.message?.includes('position') || chunkError.message?.includes('bounds')) {
          diagLogger.info('FIREBASE_CHUNK_END_OF_FILE', { chunk: chunkIndex });
          break;
        }
        throw chunkError;
      }
    }
    
    const readDuration = Date.now() - readStart;
    fileSize = totalBytesRead;
    
    diagLogger.info('FIREBASE_READ_COMPLETE', { 
      chunks: chunks.length,
      totalBytes: totalBytesRead,
      totalMB: (totalBytesRead / 1024 / 1024).toFixed(2),
      readDurationMs: readDuration,
    });

    // Combine all chunks into one Uint8Array
    diagLogger.info('FIREBASE_COMBINING_CHUNKS', { totalChunks: chunks.length });
    const combinedArray = new Uint8Array(totalBytesRead);
    let offset = 0;
    for (const chunk of chunks) {
      combinedArray.set(chunk, offset);
      offset += chunk.length;
    }
    
    // Create blob from combined array
    const contentType = mediaType === 'image' ? 'image/jpeg' : 'video/mp4';
    const blob = new Blob([combinedArray], { type: contentType });
    
    diagLogger.info('FIREBASE_BLOB_CREATED', { 
      blobSize: blob.size,
      blobSizeMB: (blob.size / 1024 / 1024).toFixed(2),
      contentType,
    });

    // Update progress
    if (onProgress) {
      onProgress({ progress: 50, bytesTransferred: fileSize / 2, totalBytes: fileSize });
    }

    // Upload to Firebase
    const storageRef = ref(storage, storagePath);
    const metadata = { contentType };
    
    diagLogger.info('FIREBASE_STARTING_UPLOAD', { 
      sizeMB: (blob.size / 1024 / 1024).toFixed(2) 
    });
    
    const uploadStart = Date.now();

    return new Promise((resolve) => {
      const uploadTask = uploadBytesResumable(storageRef, blob, metadata);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          const adjustedProgress = 50 + (progress / 2); // 50-100%
          
          if (onProgress) {
            onProgress({
              progress: Math.round(adjustedProgress),
              bytesTransferred: snapshot.bytesTransferred,
              totalBytes: snapshot.totalBytes,
            });
          }
          
          // Log at milestones
          const pct = Math.round(progress);
          if (pct % 25 === 0 && pct > 0) {
            diagLogger.info('FIREBASE_UPLOAD_PROGRESS', {
              progress: pct,
              transferred: `${(snapshot.bytesTransferred / 1024 / 1024).toFixed(1)}MB`,
              total: `${(snapshot.totalBytes / 1024 / 1024).toFixed(1)}MB`,
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
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            const uploadDuration = Date.now() - uploadStart;
            const totalDuration = Date.now() - startTime;
            
            diagLogger.info('FIREBASE_UPLOAD_SUCCESS', {
              totalDurationMs: totalDuration,
              uploadDurationMs: uploadDuration,
              sizeMB: (fileSize / 1024 / 1024).toFixed(2),
              url: downloadURL.substring(0, 80) + '...',
            });
            
            if (onProgress) {
              onProgress({ progress: 100, bytesTransferred: fileSize, totalBytes: fileSize });
            }
            
            resolve({ success: true, url: downloadURL });
          } catch (urlError: any) {
            diagLogger.error('FIREBASE_GET_URL_ERROR', { error: urlError.message });
            resolve({ success: false, error: `Failed to get URL: ${urlError.message}` });
          }
        }
      );
    });

  } catch (error: any) {
    const duration = Date.now() - startTime;
    diagLogger.error('FIREBASE_UPLOAD_FAILED', {
      error: error.message,
      code: error.code,
      durationMs: duration,
    });
    return { success: false, error: `Upload error: ${error.message}` };
  }
}

export async function uploadMultipleMedia(
  files: Array<{
    uri: string;
    inspectionId: string;
    questionId: string;
    mediaType: 'image' | 'video';
  }>,
  onProgress?: (index: number, progress: UploadProgress) => void
): Promise<Array<UploadResult & { questionId: string }>> {
  const results: Array<UploadResult & { questionId: string }> = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const result = await uploadMediaToFirebase(
      file.uri,
      file.inspectionId,
      file.questionId,
      file.mediaType,
      onProgress ? (p) => onProgress(i, p) : undefined
    );
    results.push({ ...result, questionId: file.questionId });
  }

  return results;
}

export default uploadMediaToFirebase;
