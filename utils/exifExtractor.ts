// Extract metadata from images and videos

export interface MediaMetadata {
  filename?: string;
  size?: string;
  type?: string;
  resolution?: string;
  dimensions?: string;
  duration?: string;
  fps?: string;
  format?: string;
  dateTaken?: string;
  createdAt?: number;
  updatedAt?: number;
}

// Extract image metadata
export const extractImageMetadata = async (file: File, dataUrl: string): Promise<MediaMetadata> => {
  return new Promise((resolve) => {
    const img = new Image();

    img.onload = () => {
      const metadata: MediaMetadata = {
        filename: file.name,
        size: `${(file.size / 1024 / 1024).toFixed(1)}MB`,
        type: file.type,
        dimensions: `${img.width} × ${img.height}`,
        resolution: `${img.width}×${img.height}`,
        format: file.type.split('/')[1]?.toUpperCase() || 'Unknown',
      };

      // Try to get date from file
      if (file.lastModified) {
        const date = new Date(file.lastModified);
        metadata.dateTaken = date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
      }

      resolve(metadata);
    };

    img.onerror = () => {
      resolve({
        filename: file.name,
        size: `${(file.size / 1024 / 1024).toFixed(1)}MB`,
        type: file.type,
      });
    };

    img.src = dataUrl;
  });
};

// Extract video metadata
export const extractVideoMetadata = async (file: File, dataUrl: string): Promise<MediaMetadata> => {
  return new Promise((resolve) => {
    const video = document.createElement('video');

    video.onloadedmetadata = () => {
      const metadata: MediaMetadata = {
        filename: file.name,
        size: `${(file.size / 1024 / 1024).toFixed(1)}MB`,
        type: file.type,
        dimensions: `${video.videoWidth} × ${video.videoHeight}`,
        resolution: `${video.videoWidth}×${video.videoHeight}`,
        duration: formatDuration(video.duration),
        format: file.type.split('/')[1]?.toUpperCase() || 'Unknown',
      };

      // Try to get date from file
      if (file.lastModified) {
        const date = new Date(file.lastModified);
        metadata.dateTaken = date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
      }

      resolve(metadata);
    };

    video.onerror = () => {
      resolve({
        filename: file.name,
        size: `${(file.size / 1024 / 1024).toFixed(1)}MB`,
        type: file.type,
      });
    };

    video.src = dataUrl;
  });
};

// Format seconds to MM:SS
const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};
