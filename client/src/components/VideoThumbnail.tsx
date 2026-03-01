import { useEffect, useState } from "react";
import "./VideoThumbnail.css";

interface VideoThumbnailProps {
    src: string;
    alt: string;
    width: number;
    height: number;
    onClick?: () => void;
    onDoubleClick?: () => void;
    onError?: () => void;
}

function VideoThumbnail({
    src,
    alt,
    width,
    height,
    onClick,
    onDoubleClick,
    onError: onErrorCallback,
}: VideoThumbnailProps) {
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(true);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);

    useEffect(() => {
        let currentBlobUrl: string | null = null;
        let cancelled = false;

        // Fetch video with auth token and create blob URL
        const loadVideo = async () => {
            try {
                const token = localStorage.getItem("token");
                const headers: HeadersInit = {};

                if (token) {
                    headers.Authorization = `Bearer ${token}`;
                }

                console.log("Fetching video:", src);
                const response = await fetch(src, { headers });

                console.log("Video fetch response:", {
                    status: response.status,
                    statusText: response.statusText,
                    contentType: response.headers.get("content-type"),
                    contentLength: response.headers.get("content-length"),
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error("Video fetch failed:", errorText);
                    throw new Error(
                        `HTTP error! status: ${response.status}, body: ${errorText.substring(0, 100)}`
                    );
                }

                if (cancelled) return;

                const blob = await response.blob();
                console.log("Video blob created:", {
                    size: blob.size,
                    type: blob.type,
                });

                if (blob.size === 0) {
                    console.error("Video blob is empty, response details:", {
                        status: response.status,
                        contentType: response.headers.get("content-type"),
                        contentLength: response.headers.get("content-length"),
                    });
                    throw new Error("Video blob is empty - preview generation may have failed");
                }

                const blobUrl = URL.createObjectURL(blob);
                currentBlobUrl = blobUrl;

                console.log("Video blob URL created:", blobUrl);

                if (!cancelled) {
                    setVideoUrl(blobUrl);
                    setLoading(false);
                } else {
                    URL.revokeObjectURL(blobUrl);
                }
            } catch (err) {
                if (!cancelled) {
                    console.error("Failed to load video:", err);
                    setError(true);
                    setLoading(false);
                    onErrorCallback?.();
                }
            }
        };

        loadVideo();

        // Cleanup blob URL on unmount or src change
        return () => {
            cancelled = true;
            if (currentBlobUrl) {
                URL.revokeObjectURL(currentBlobUrl);
            }
        };
    }, [onErrorCallback, src]);

    const handleError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
        const videoElement = e.currentTarget;
        console.error("Video playback error:", {
            src,
            error: videoElement.error,
            networkState: videoElement.networkState,
            readyState: videoElement.readyState,
        });
        setError(true);
        setLoading(false);
        onErrorCallback?.();
    };

    const handleLoadedData = () => {
        setLoading(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick?.();
        }
    };

    if (error || !videoUrl) {
        return (
            <button
                type="button"
                className="video-thumbnail-error"
                style={{ width, height }}
                onClick={onClick}
                onDoubleClick={onDoubleClick}
                onKeyDown={handleKeyDown}
            >
                <span>{loading ? "Loading..." : "Video Preview"}</span>
            </button>
        );
    }

    return (
        <div style={{ width, height, position: "relative" }}>
            {loading && (
                <div
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "#000",
                        color: "#fff",
                        fontSize: "0.75rem",
                        zIndex: 1,
                    }}
                >
                    Loading...
                </div>
            )}
            <video
                src={videoUrl}
                width={width}
                height={height}
                className="video-thumbnail"
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
                onClick={(e) => {
                    e.stopPropagation();
                    onClick?.();
                }}
                onDoubleClick={(e) => {
                    e.stopPropagation();
                    onDoubleClick?.();
                }}
                onKeyDown={handleKeyDown}
                onError={handleError}
                onLoadedData={handleLoadedData}
                style={{ pointerEvents: "auto", cursor: "pointer" }}
                aria-label={alt}
            >
                <track kind="captions" />
            </video>
        </div>
    );
}

export default VideoThumbnail;
