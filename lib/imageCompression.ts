/**
 * Compresses an image file if it exceeds the specified size threshold
 * @param file - The image file to compress
 * @param maxSizeMB - Maximum file size in MB before compression (default: 1MB)
 * @param maxWidthOrHeight - Maximum width or height in pixels (default: 1920)
 * @param quality - Compression quality 0-1 (default: 0.8)
 * @returns Promise<File> - Compressed image file
 */
export async function compressImage(
  file: File,
  maxSizeMB: number = 1,
  maxWidthOrHeight: number = 1920,
  quality: number = 0.8
): Promise<File> {
  // If file is already small enough, return as-is
  const fileSizeMB = file.size / (1024 * 1024);
  if (fileSizeMB <= maxSizeMB) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        // Calculate new dimensions
        let width = img.width;
        let height = img.height;

        if (width > maxWidthOrHeight || height > maxWidthOrHeight) {
          if (width > height) {
            height = (height / width) * maxWidthOrHeight;
            width = maxWidthOrHeight;
          } else {
            width = (width / height) * maxWidthOrHeight;
            height = maxWidthOrHeight;
          }
        }

        // Create canvas and draw resized image
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Convert canvas to blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'));
              return;
            }

            // Create new file from blob
            const compressedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now(),
            });

            resolve(compressedFile);
          },
          file.type,
          quality
        );
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Compresses multiple image files
 * @param files - Array of image files to compress
 * @param maxSizeMB - Maximum file size in MB before compression
 * @param maxWidthOrHeight - Maximum width or height in pixels
 * @param quality - Compression quality 0-1
 * @returns Promise<File[]> - Array of compressed image files
 */
export async function compressImages(
  files: File[],
  maxSizeMB: number = 1,
  maxWidthOrHeight: number = 1920,
  quality: number = 0.8
): Promise<File[]> {
  const compressionPromises = files.map(file =>
    compressImage(file, maxSizeMB, maxWidthOrHeight, quality)
  );

  return Promise.all(compressionPromises);
}
