// Firebase Storage upload service for media files
// Uses expo-file-system for reliable file reading in React Native
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import * as FileSystem from 'expo-file-system';
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
 * Uses expo-file-system to read file as base64, then uploads using uploadString
 * 
 * @param uri - Local file URI (file://...)
 * @param inspectionId - Inspection ID for folder organization
 * @param questionId - Question ID for file naming
 * @param mediaType - 'image' or 'video'
 * @param onProgress - Optional progress callback (limited for uploadString)
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

    // Step 1: Get file info first
    diagLogger.info('FIREBASE_GETTING_FILE_INFO', { uri: uri.substring(0, 40) });
    const fileInfo = await FileSystem.getInfoAsync(uri);
    
    if (!fileInfo.exists) {
      throw new Error('File does not exist at the specified URI');
    }
    
    // FileInfo doesn't have size in new API, so we estimate later
    diagLogger.info('FIREBASE_FILE_INFO', { 
      exists: fileInfo.exists,
      uri: fileInfo.uri?.substring(0, 40),
    });

    // Notify progress - reading file
    if (onProgress) {
      onProgress({ progress: 10, bytesTransferred: 0, totalBytes: 0 });
    }

    // Step 2: Read file as base64 using string encoding type
    diagLogger.info('FIREBASE_READING_BASE64', {});
    const readStart = Date.now();
    
    const base64Data = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64',
    });
    
    const readDuration = Date.now() - readStart;
    const base64SizeMB = (base64Data.length * 0.75) / (1024 * 1024); // Approximate original size
    
    diagLogger.info('FIREBASE_BASE64_READ_COMPLETE', { 
      readDurationMs: readDuration,
      base64Length: base64Data.length,
      estimatedSizeMB: base64SizeMB.toFixed(2),
    });

    // Notify progress - file read complete
    if (onProgress) {
      onProgress({ progress: 40, bytesTransferred: fileSizeBytes * 0.4, totalBytes: fileSizeBytes });
    }

    // Step 3: Create storage reference
    const storageRef = ref(storage, storagePath);

    // Step 4: Determine content type and create data URL
    const contentType = mediaType === 'image' ? 'image/jpeg' : 'video/mp4';
    const dataUrl = `data:${contentType};base64,${base64Data}`;
    
    diagLogger.info('FIREBASE_STARTING_UPLOAD', { 
      contentType,
      dataUrlLength: dataUrl.length,
    });

    // Notify progress - starting upload
    if (onProgress) {
      onProgress({ progress: 50, bytesTransferred: fileSizeBytes * 0.5, totalBytes: fileSizeBytes });
    }

    // Step 5: Upload using uploadString with data_url format
    const uploadStart = Date.now();
    const snapshot = await uploadString(storageRef, dataUrl, 'data_url');
    const uploadDuration = Date.now() - uploadStart;
    
    diagLogger.info('FIREBASE_UPLOAD_COMPLETE', { 
      uploadDurationMs: uploadDuration,
      uploadDurationSec: (uploadDuration / 1000).toFixed(1),
      bytesTransferred: snapshot.metadata.size,
    });

    // Notify progress - upload complete
    if (onProgress) {
      onProgress({ progress: 90, bytesTransferred: fileSizeBytes * 0.9, totalBytes: fileSizeBytes });
    }

    // Step 6: Get download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    const totalDuration = Date.now() - startTime;
    
    diagLogger.info('FIREBASE_UPLOAD_SUCCESS', {
      totalDurationMs: totalDuration,
      totalDurationSec: (totalDuration / 1000).toFixed(1),
      sizeMB: fileSizeMB.toFixed(2),
      readTime: `${(readDuration / 1000).toFixed(1)}s`,
      uploadTime: `${(uploadDuration / 1000).toFixed(1)}s`,
      url: downloadURL.substring(0, 80) + '...',
    });

    // Notify progress - complete
    if (onProgress) {
      onProgress({ progress: 100, bytesTransferred: fileSizeBytes, totalBytes: fileSizeBytes });
    }

    return {
      success: true,
      url: downloadURL,
    };

  } catch (error: any) {
    const duration = Date.now() - startTime;
    diagLogger.error('FIREBASE_UPLOAD_FAILED', {
      error: error.message,
      code: error.code,
      durationMs: duration,
      stack: error.stack?.substring(0, 200),
    });
    return {
      success: false,
      error: `Upload error: ${error.message}`,
    };
  }
}

/**
 * Upload multiple files in sequence
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

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    diagLogger.info('FIREBASE_BATCH_ITEM', { 
      index: i + 1, 
      total: files.length, 
      questionId: file.questionId 
    });
    
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
