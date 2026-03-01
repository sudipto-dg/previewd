import { apiService } from "../services/api.js";

const VIDEO_EXTENSIONS = [".mp4", ".avi", ".mov", ".mkv", ".webm", ".m4v"];

export function isVideoFile(filePath: string): boolean {
    const extension = filePath.toLowerCase().substring(filePath.lastIndexOf("."));
    return VIDEO_EXTENSIONS.includes(extension);
}

export function buildVideoFileUrl(filePath: string): string {
    const token = localStorage.getItem("token");
    if (!token) {
        throw new Error("Authentication token not found");
    }

    const relativeUrl = `/api/file?path=${encodeURIComponent(filePath)}&token=${encodeURIComponent(token)}`;
    return new URL(relativeUrl, window.location.origin).toString();
}

export async function openFile(filePath: string): Promise<void> {
    // For video files, open in new browser tab using /api/file endpoint
    if (isVideoFile(filePath)) {
        const url = buildVideoFileUrl(filePath);
        window.open(url, "_blank");
        return;
    }

    // For non-video files, use the existing server-side open behavior
    try {
        await apiService.openFile(filePath);
    } catch (error) {
        console.error("Failed to open file:", error);
        throw error;
    }
}
