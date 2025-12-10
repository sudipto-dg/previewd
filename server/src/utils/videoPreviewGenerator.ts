import fs from "node:fs";
import path from "node:path";
import { generateVideoPreviewClip } from "./thumbnail.js";
import { getConfig } from "./configLoader.js";

const VIDEO_EXTENSIONS = [
  ".mp4",
  ".avi",
  ".mov",
  ".mkv",
  ".webm",
  ".flv",
  ".wmv",
  ".m4v",
  ".3gp",
];

/**
 * Pre-generate video preview clips for all videos in a folder (recursively)
 */
export async function pregenerateVideoPreviewsForFolder(
  folderPath: string,
  previewDuration: number = 10,
  onProgress?: (current: number, total: number, currentFile: string) => void,
): Promise<void> {
  const videoFiles: string[] = [];

  // Recursively collect all video files
  function collectVideos(dir: string): void {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (VIDEO_EXTENSIONS.includes(ext)) {
            videoFiles.push(fullPath);
          }
        } else if (entry.isDirectory()) {
          // Skip hidden/system directories
          if (!entry.name.startsWith(".")) {
            try {
              collectVideos(fullPath);
            } catch (error) {
              // Skip directories we can't access
              console.warn(`Skipping directory ${fullPath}:`, error);
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${dir}:`, error);
      throw error;
    }
  }

  collectVideos(folderPath);

  if (videoFiles.length === 0) {
    console.log(`No video files found in ${folderPath}`);
    return;
  }

  console.log(`Found ${videoFiles.length} video files in ${folderPath}`);

  // Generate previews with concurrency limit
  const concurrencyLimit = 3; // Process 3 videos at a time to avoid overwhelming system
  let processed = 0;

  for (let i = 0; i < videoFiles.length; i += concurrencyLimit) {
    const batch = videoFiles.slice(i, i + concurrencyLimit);

    await Promise.all(
      batch.map(async (videoFile) => {
        try {
          // Check if preview already exists by trying to generate it
          // (it will return cached path if exists)
          await generateVideoPreviewClip(videoFile, previewDuration);
          processed++;
          onProgress?.(processed, videoFiles.length, videoFile);
        } catch (error) {
          console.warn(`Failed to generate preview for ${videoFile}:`, error);
          // Continue with other files even if one fails
        }
      }),
    );
  }

  console.log(`Generated ${processed}/${videoFiles.length} video previews`);
}

/**
 * Pre-generate video previews for all configured folders
 */
export async function pregenerateVideoPreviews(
  onProgress?: (folder: string, current: number, total: number) => void,
): Promise<void> {
  const config = getConfig();
  const previewDuration = config.video.previewDuration || 10;

  for (const folder of config.folders) {
    if (!folder.enabled) {
      continue;
    }

    try {
      console.log(`Pre-generating video previews for: ${folder.path}`);
      await pregenerateVideoPreviewsForFolder(
        folder.path,
        previewDuration,
        (current, total, currentFile) => {
          onProgress?.(folder.name, current, total);
          if (current % 10 === 0 || current === total) {
            console.log(
              `[${folder.name}] Progress: ${current}/${total} - ${path.basename(currentFile)}`,
            );
          }
        },
      );
    } catch (error) {
      console.error(`Failed to pre-generate previews for ${folder.path}:`, error);
    }
  }
}

