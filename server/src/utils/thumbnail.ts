import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import ffmpeg from "fluent-ffmpeg";
import sharp from "sharp";
import { getCache, getCacheKey } from "./cache.js";
import { getConfig } from "./configLoader.js";
import { getCachedThumbnail, saveThumbnailToCache } from "./thumbnailCache.js";

// Configure fluent-ffmpeg to use the bundled FFmpeg binary
try {
    ffmpeg.setFfmpegPath(ffmpegInstaller.path);
} catch (error) {
    console.error("Failed to set FFmpeg path:", error);
    throw new Error(
        "FFmpeg binary not found. Please ensure @ffmpeg-installer/ffmpeg is installed."
    );
}

// Configure fluent-ffmpeg to use the bundled ffprobe binary
try {
    ffmpeg.setFfprobePath(ffprobeInstaller.path);
} catch (error) {
    console.error("Failed to set ffprobe path:", error);
    throw new Error(
        "ffprobe binary not found. Please ensure @ffprobe-installer/ffprobe is installed."
    );
}

const IMAGE_EXTENSIONS = [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".bmp",
    ".webp",
    ".svg",
    ".tiff",
    ".ico",
];
const VIDEO_EXTENSIONS = [".mp4", ".avi", ".mov", ".mkv", ".webm", ".flv", ".wmv", ".m4v", ".3gp"];

function isImage(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return IMAGE_EXTENSIONS.includes(ext);
}

function isVideo(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return VIDEO_EXTENSIONS.includes(ext);
}

async function generateImageThumbnail(
    filePath: string,
    width: number,
    height: number
): Promise<string> {
    const buffer = await sharp(filePath)
        .resize(width, height, {
            fit: "inside",
            withoutEnlargement: true,
        })
        .jpeg({ quality: 80 })
        .toBuffer();

    return `data:image/jpeg;base64,${buffer.toString("base64")}`;
}

async function generateVideoThumbnail(
    filePath: string,
    width: number,
    height: number,
    timeSeconds = 1
): Promise<string> {
    return new Promise((resolve, reject) => {
        const tempOutput = path.join(os.tmpdir(), `thumb_${Date.now()}.jpg`);

        ffmpeg(filePath)
            .screenshots({
                timestamps: [timeSeconds],
                filename: path.basename(tempOutput),
                folder: path.dirname(tempOutput),
                size: `${width}x${height}`,
            })
            .on("end", async () => {
                try {
                    const buffer = await sharp(tempOutput)
                        .resize(width, height, {
                            fit: "inside",
                            withoutEnlargement: true,
                        })
                        .jpeg({ quality: 80 })
                        .toBuffer();

                    // Clean up temp file
                    fs.unlinkSync(tempOutput);

                    resolve(`data:image/jpeg;base64,${buffer.toString("base64")}`);
                } catch (error) {
                    reject(error);
                }
            })
            .on("error", (err) => {
                // Clean up temp file if it exists
                if (fs.existsSync(tempOutput)) {
                    fs.unlinkSync(tempOutput);
                }
                reject(err);
            });
    });
}

export async function generateThumbnail(
    filePath: string,
    width = 300,
    height = 300,
    videoTimeSeconds?: number
): Promise<string> {
    const config = getConfig();
    const cache = getCache();
    const cacheKey = getCacheKey(filePath, width, height);

    // Check disk cache first (persistent)
    if (config.thumbnail.cache.enabled) {
        const diskCached = getCachedThumbnail(filePath, width, height);
        if (diskCached) {
            // Also store in memory cache for faster access
            cache.set(cacheKey, diskCached);
            return diskCached;
        }

        // Check memory cache
        const memoryCached = cache.get<string>(cacheKey);
        if (memoryCached) {
            return memoryCached;
        }
    }

    let thumbnail: string;

    if (isImage(filePath)) {
        thumbnail = await generateImageThumbnail(filePath, width, height);
    } else if (isVideo(filePath)) {
        const time = videoTimeSeconds ?? config.video.thumbnailTime;
        thumbnail = await generateVideoThumbnail(filePath, width, height, time);
    } else {
        // Return a placeholder for unsupported file types
        thumbnail = generatePlaceholderThumbnail(width, height);
    }

    // Store in both caches
    if (config.thumbnail.cache.enabled) {
        cache.set(cacheKey, thumbnail);
        // Save to disk cache for persistence
        if (isImage(filePath) || isVideo(filePath)) {
            saveThumbnailToCache(filePath, width, height, thumbnail);
        }
    }

    return thumbnail;
}

function generatePlaceholderThumbnail(width: number, height: number): string {
    // Generate a simple placeholder image
    const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#e0e0e0"/>
      <text x="50%" y="50%" font-family="Arial" font-size="14" fill="#666" text-anchor="middle" dy=".3em">
        No Preview
      </text>
    </svg>
  `;

    return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

/**
 * Get video duration in seconds using ffprobe
 */
function getVideoDuration(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) {
                reject(err);
                return;
            }
            const duration = metadata.format.duration;
            if (!duration || Number.isNaN(duration)) {
                reject(new Error("Could not determine video duration"));
                return;
            }
            resolve(duration);
        });
    });
}

/**
 * Generate a short video preview clip (15 seconds) from the middle of a video file
 * Returns the path to the generated preview clip file
 */
export async function generateVideoPreviewClip(
    filePath: string,
    durationSeconds = 15,
    startTimeSeconds?: number
): Promise<string> {
    // Store previews in project directory instead of temp
    const previewDir = path.join(process.cwd(), ".video-previews");

    // Ensure preview directory exists
    if (!fs.existsSync(previewDir)) {
        fs.mkdirSync(previewDir, { recursive: true });
    }

    // Get video duration and calculate start time from middle
    let actualStartTime: number;
    let actualDuration: number;

    try {
        const videoDuration = await getVideoDuration(filePath);
        console.log(`Video duration: ${videoDuration} seconds`);

        // Calculate start time from middle: (duration / 2) - (previewDuration / 2)
        // Ensure we don't go negative
        const middleStart = Math.max(0, videoDuration / 2 - durationSeconds / 2);
        actualStartTime = startTimeSeconds !== undefined ? startTimeSeconds : middleStart;
        actualDuration = Math.min(durationSeconds, videoDuration - actualStartTime);

        // If video is shorter than requested duration, start from beginning
        if (actualDuration < durationSeconds) {
            actualStartTime = 0;
            actualDuration = Math.min(durationSeconds, videoDuration);
        }

        console.log(
            `Preview: start=${actualStartTime.toFixed(2)}s, duration=${actualDuration.toFixed(2)}s`
        );
    } catch (error) {
        console.warn(`Failed to get video duration, using defaults: ${error}`);
        // Fallback to provided startTime or default
        actualStartTime = startTimeSeconds ?? 1;
        actualDuration = durationSeconds;
    }

    // Create a unique filename based on file path and parameters
    // Use crypto hash for better uniqueness
    const crypto = await import("node:crypto");
    const fileHash = crypto.createHash("md5").update(filePath).digest("hex");
    const previewPath = path.join(
        previewDir,
        `preview_${fileHash}_${Math.round(actualStartTime)}_${Math.round(actualDuration)}.mp4`
    );

    // Check if preview already exists and has content
    if (fs.existsSync(previewPath)) {
        const stats = fs.statSync(previewPath);
        if (stats.size > 0) {
            return previewPath;
        }
        // Remove empty preview file
        fs.unlinkSync(previewPath);
    }

    return new Promise((resolve, reject) => {
        // Check if source file exists
        if (!fs.existsSync(filePath)) {
            reject(new Error(`Source video file not found: ${filePath}`));
            return;
        }

        ffmpeg(filePath)
            .setStartTime(actualStartTime)
            .setDuration(actualDuration)
            .videoCodec("libx264")
            .audioCodec("aac")
            .outputOptions([
                "-preset fast",
                "-crf 28", // Lower quality for smaller file size
                "-movflags +faststart", // Optimize for web streaming
                "-vf scale=640:-2", // Limit resolution for smaller files
                "-an", // Remove audio to reduce file size
            ])
            .output(previewPath)
            .on("start", (commandLine) => {
                console.log(`FFmpeg command: ${commandLine}`);
            })
            .on("progress", (progress) => {
                console.log(`Preview generation progress: ${JSON.stringify(progress)}`);
            })
            .on("end", () => {
                // Verify the file was created and has content
                try {
                    if (!fs.existsSync(previewPath)) {
                        reject(new Error("Preview clip file was not created"));
                        return;
                    }

                    const stats = fs.statSync(previewPath);
                    if (stats.size === 0) {
                        // Clean up empty file
                        fs.unlinkSync(previewPath);
                        reject(new Error("Generated preview clip is empty"));
                        return;
                    }

                    console.log(
                        `Preview clip generated successfully: ${previewPath} (${stats.size} bytes)`
                    );
                    resolve(previewPath);
                } catch (error) {
                    reject(new Error(`Failed to verify preview clip: ${error}`));
                }
            })
            .on("error", (err, stdout, stderr) => {
                console.error("FFmpeg error:", err);
                console.error("FFmpeg stdout:", stdout);
                console.error("FFmpeg stderr:", stderr);

                // Clean up on error
                if (fs.existsSync(previewPath)) {
                    try {
                        fs.unlinkSync(previewPath);
                    } catch {
                        // Ignore cleanup errors
                    }
                }
                reject(
                    new Error(`FFmpeg error: ${err.message || err}. stderr: ${stderr || "none"}`)
                );
            })
            .run();
    });
}
