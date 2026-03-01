import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const CACHE_DIR_NAME = ".thumbnail-cache";

function getCacheDir(): string {
    const cacheDir = path.join(process.cwd(), CACHE_DIR_NAME);
    if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
    }
    return cacheDir;
}

function getThumbnailCachePath(filePath: string, width: number, height: number): string {
    const cacheDir = getCacheDir();
    // Create hash of file path + dimensions
    const hash = crypto.createHash("md5").update(`${filePath}:${width}:${height}`).digest("hex");
    return path.join(cacheDir, `${hash}.jpg`);
}

export function getCachedThumbnail(filePath: string, width: number, height: number): string | null {
    const cachePath = getThumbnailCachePath(filePath, width, height);
    if (fs.existsSync(cachePath)) {
        // Check if file was modified (invalidate cache if source file changed)
        try {
            const sourceStats = fs.statSync(filePath);
            const cacheStats = fs.statSync(cachePath);

            // If source file is newer than cache, invalidate
            if (sourceStats.mtime > cacheStats.mtime) {
                return null;
            }

            // Read cached thumbnail as base64
            const buffer = fs.readFileSync(cachePath);
            return `data:image/jpeg;base64,${buffer.toString("base64")}`;
        } catch (_error) {
            return null;
        }
    }
    return null;
}

export function saveThumbnailToCache(
    filePath: string,
    width: number,
    height: number,
    thumbnailData: string
): void {
    try {
        // Extract base64 data if it's a data URL
        let base64Data = thumbnailData;
        if (thumbnailData.startsWith("data:")) {
            const base64Match = thumbnailData.match(/base64,(.+)$/);
            if (base64Match) {
                base64Data = base64Match[1];
            }
        }

        const cachePath = getThumbnailCachePath(filePath, width, height);
        const buffer = Buffer.from(base64Data, "base64");
        fs.writeFileSync(cachePath, buffer);
    } catch (error) {
        console.error("Failed to save thumbnail to cache:", error);
    }
}

export async function pregenerateThumbnailsForFolder(
    folderPath: string,
    width = 300,
    height = 300,
    onProgress?: (current: number, total: number) => void
): Promise<void> {
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

    try {
        const entries = fs.readdirSync(folderPath, { withFileTypes: true });
        const videoFiles: string[] = [];

        // Collect all video files
        for (const entry of entries) {
            if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                if (VIDEO_EXTENSIONS.includes(ext)) {
                    videoFiles.push(path.join(folderPath, entry.name));
                }
            } else if (entry.isDirectory()) {
                // Recursively process subdirectories
                try {
                    await pregenerateThumbnailsForFolder(
                        path.join(folderPath, entry.name),
                        width,
                        height,
                        onProgress
                    );
                } catch (error) {
                    // Skip directories we can't access
                    console.warn(`Skipping directory ${entry.name}:`, error);
                }
            }
        }

        // Generate thumbnails for videos
        const { generateThumbnail } = await import("./thumbnail.js");
        let processed = 0;

        for (const videoFile of videoFiles) {
            try {
                // Check if already cached
                const cached = getCachedThumbnail(videoFile, width, height);
                if (!cached) {
                    await generateThumbnail(videoFile, width, height);
                }
                processed++;
                onProgress?.(processed, videoFiles.length);
            } catch (error) {
                console.warn(`Failed to generate thumbnail for ${videoFile}:`, error);
            }
        }
    } catch (error) {
        console.error(`Failed to pregenerate thumbnails for ${folderPath}:`, error);
        throw error;
    }
}
