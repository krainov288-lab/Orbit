import { api } from '../services/api';
import { compressImage } from '../services/media';

/**
 * Checks if a given media URL or data URI is a video format
 */
export const isVideoUrl = (url?: string | null): boolean => {
  if (!url) return false;
  if (url.startsWith('data:video/')) return true;
  if (url.startsWith('blob:') && url.includes('video')) return true;
  const clean = url.split('?')[0].toLowerCase();
  return (
    clean.endsWith('.mp4') ||
    clean.endsWith('.webm') ||
    clean.endsWith('.mov') ||
    clean.endsWith('.m4v') ||
    clean.endsWith('.mkv') ||
    clean.endsWith('.avi') ||
    clean.includes('/uploads/video') ||
    clean.includes('video')
  );
};

/**
 * Checks if a video file's duration is within allowed limit (in seconds)
 */
export const checkVideoDuration = (
  file: File,
  maxSeconds = 60
): Promise<{ valid: boolean; duration: number }> => {
  return new Promise((resolve) => {
    if (!file.type.startsWith('video/')) {
      resolve({ valid: true, duration: 0 });
      return;
    }
    const video = document.createElement('video');
    video.preload = 'metadata';
    const objectUrl = URL.createObjectURL(file);
    
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl);
      const dur = video.duration || 0;
      // Allow a tiny margin for float duration rounding (e.g., 60.8s)
      if (dur > maxSeconds + 0.9) {
        resolve({ valid: false, duration: dur });
      } else {
        resolve({ valid: true, duration: dur });
      }
    };
    
    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ valid: true, duration: 0 });
    };
    
    video.src = objectUrl;
  });
};

/**
 * Compress image or process video file for story slide upload
 */
export const processMediaFileForStory = async (file: File): Promise<string> => {
  let fileToUpload = file;
  if (file.type.startsWith('image/')) {
    try {
      fileToUpload = await compressImage(file, 1080, 1920, 0.85);
    } catch (e) {
      console.error('Failed to compress story image:', e);
    }
  }

  // Try uploading via API first for local disk storage
  try {
    const res = await api.uploadMedia(fileToUpload);
    if (res?.url) return res.url;
  } catch {
    // API upload failed, fallback to reader
  }

  // Fallback: convert file to data URL or compressed image canvas
  if (file.type.startsWith('video/')) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve((e.target?.result as string) || '');
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxWidth = 1080;
        const maxHeight = 1920;
        let width = img.width;
        let height = img.height;
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } else {
          resolve(e.target?.result as string);
        }
      };
      img.onerror = () => resolve(e.target?.result as string);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(fileToUpload);
  });
};
