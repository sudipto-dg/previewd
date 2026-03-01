import { useEffect, useState } from "react";
import type { FileItem } from "../types/index.js";
import { openFile } from "../utils/fileOpener.js";
import "./ThumbnailItem.css";

interface ThumbnailItemProps {
    item: FileItem;
    thumbnail?: string;
    size: number;
    onClick?: () => void;
}

const VIDEO_EXTENSIONS = [".mp4", ".avi", ".mov", ".mkv", ".webm", ".m4v"];
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg"];

function ThumbnailItem({ item, size, onClick }: ThumbnailItemProps) {
    const [imageError, setImageError] = useState(false);
    const [videoError, setVideoError] = useState(false);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [videoLoading, setVideoLoading] = useState(false);
    const isVideo =
        item.type === "file" &&
        item.extension &&
        VIDEO_EXTENSIONS.includes(item.extension.toLowerCase());
    const isImage =
        item.type === "file" &&
        item.extension &&
        IMAGE_EXTENSIONS.includes(item.extension.toLowerCase());

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onClick) {
            onClick();
        } else if (item.type === "file") {
            openFile(item.path).catch((err) => {
                console.error("Failed to open file:", err);
            });
        }
    };

    const handleDoubleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (item.type === "file") {
            openFile(item.path).catch((err) => {
                console.error("Failed to open file:", err);
            });
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (onClick) {
                onClick();
            } else if (item.type === "file") {
                openFile(item.path).catch((err) => {
                    console.error("Failed to open file:", err);
                });
            }
        }
    };

    // Generate URLs: preview clips for videos (thumbnails), original files for images
    const videoPreviewUrl = isVideo
        ? `/api/video-preview?path=${encodeURIComponent(item.path)}`
        : null;
    const fileUrl =
        item.type === "file" && !isVideo ? `/api/file?path=${encodeURIComponent(item.path)}` : null;

    // Fetch video preview with auth and create blob URL
    useEffect(() => {
        if (!isVideo || !videoPreviewUrl) {
            setVideoUrl(null);
            return;
        }

        let cancelled = false;
        let blobUrl: string | null = null;

        const loadVideo = async () => {
            if (!cancelled) {
                setVideoLoading(true);
                setVideoError(false);
            }

            try {
                const token = localStorage.getItem("token");
                const headers: HeadersInit = {};
                if (token) {
                    headers.Authorization = `Bearer ${token}`;
                }

                console.log("Loading video preview:", videoPreviewUrl);

                // Use arrayBuffer instead of blob to ensure we get all data
                const response = await fetch(videoPreviewUrl, { headers });

                console.log("Video preview response:", {
                    status: response.status,
                    ok: response.ok,
                    contentType: response.headers.get("content-type"),
                    contentLength: response.headers.get("content-length"),
                });

                if (!response.ok) {
                    const errorText = await response.text().catch(() => "");
                    console.error("Video preview fetch failed:", response.status, errorText);
                    throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 100)}`);
                }

                if (cancelled) return;

                const contentLength = response.headers.get("content-length");
                const expectedSize = contentLength ? Number.parseInt(contentLength, 10) : null;

                // Read as arrayBuffer to ensure we get all data
                const arrayBuffer = await response.arrayBuffer();

                console.log("Video preview arrayBuffer:", {
                    size: arrayBuffer.byteLength,
                    expectedSize,
                    contentType: response.headers.get("content-type"),
                    url: videoPreviewUrl,
                });

                if (arrayBuffer.byteLength === 0) {
                    console.error("Empty video arrayBuffer received");
                    throw new Error("Empty video data - preview generation may have failed");
                }

                if (expectedSize && arrayBuffer.byteLength !== expectedSize) {
                    console.warn(
                        `Size mismatch: expected ${expectedSize}, got ${arrayBuffer.byteLength}`
                    );
                }

                // Convert arrayBuffer to blob
                const blob = new Blob([arrayBuffer], {
                    type: response.headers.get("content-type") || "video/mp4",
                });

                blobUrl = URL.createObjectURL(blob);
                if (!cancelled) {
                    setVideoUrl(blobUrl);
                    setVideoLoading(false);
                } else {
                    URL.revokeObjectURL(blobUrl);
                }
            } catch (err) {
                console.error("Failed to load video preview:", err, {
                    isVideo,
                    videoPreviewUrl,
                    itemPath: item.path,
                });
                if (!cancelled) {
                    setVideoError(true);
                    setVideoLoading(false);
                }
            }
        };

        loadVideo();

        return () => {
            cancelled = true;
            if (blobUrl) {
                URL.revokeObjectURL(blobUrl);
            }
        };
    }, [isVideo, item.path, videoPreviewUrl]);

    // Fetch image with auth and create blob URL
    useEffect(() => {
        if (!isImage || !fileUrl) {
            setImageUrl(null);
            return;
        }

        let cancelled = false;
        let blobUrl: string | null = null;

        const loadImage = async () => {
            try {
                const token = localStorage.getItem("token");
                const headers: HeadersInit = {};
                if (token) {
                    headers.Authorization = `Bearer ${token}`;
                }

                const response = await fetch(fileUrl, { headers });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                if (cancelled) return;

                const blob = await response.blob();
                if (blob.size === 0) {
                    throw new Error("Empty image blob");
                }

                blobUrl = URL.createObjectURL(blob);
                if (!cancelled) {
                    setImageUrl(blobUrl);
                } else {
                    URL.revokeObjectURL(blobUrl);
                }
            } catch (err) {
                console.error("Failed to load image:", err);
                if (!cancelled) {
                    setImageError(true);
                }
            }
        };

        loadImage();

        return () => {
            cancelled = true;
            if (blobUrl) {
                URL.revokeObjectURL(blobUrl);
            }
        };
    }, [isImage, fileUrl]);

    return (
        <div
            className="thumbnail-item"
            style={{ width: size, height: size }}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            onKeyDown={handleKeyDown}
        >
            <div className="thumbnail-content">
                {item.type === "directory" ? (
                    <div className="directory-icon" style={{ cursor: "pointer" }}>
                        <svg
                            width={size * 0.6}
                            height={size * 0.6}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                        >
                            <title>Directory</title>
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                        </svg>
                    </div>
                ) : isVideo ? (
                    videoLoading ? (
                        <div
                            className="thumbnail-placeholder"
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <span>Loading...</span>
                        </div>
                    ) : videoUrl && !videoError ? (
                        <video
                            src={videoUrl}
                            width={size}
                            height={size}
                            className="thumbnail-image"
                            onError={() => {
                                console.warn("Video preview playback failed");
                                setVideoError(true);
                            }}
                            style={{ cursor: "pointer", objectFit: "cover" }}
                            muted
                            playsInline
                            autoPlay
                            loop
                            preload="auto"
                        />
                    ) : (
                        <div className="thumbnail-placeholder">
                            <span>VIDEO</span>
                        </div>
                    )
                ) : isImage && imageUrl && !imageError ? (
                    <img
                        src={imageUrl}
                        alt={item.name}
                        className="thumbnail-image"
                        onError={() => setImageError(true)}
                        style={{ cursor: "pointer" }}
                    />
                ) : (
                    <div className="thumbnail-placeholder">
                        <span>{item.extension?.toUpperCase().slice(1) || "FILE"}</span>
                    </div>
                )}
            </div>
            <div className="thumbnail-label">
                <span className="thumbnail-label-track">
                    <span className="thumbnail-label-text">{item.name}</span>
                    <span className="thumbnail-label-text" aria-hidden="true">
                        {item.name}
                    </span>
                </span>
            </div>
        </div>
    );
}

export default ThumbnailItem;
