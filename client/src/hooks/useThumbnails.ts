import { useCallback, useEffect, useState } from "react";
import { apiService } from "../services/api.js";

interface UseThumbnailsOptions {
    paths: string[];
    width?: number;
    height?: number;
    enabled?: boolean;
}

export function useThumbnails(options: UseThumbnailsOptions) {
    const { paths, width = 300, height = 300, enabled = true } = options;
    const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    // Clear thumbnails when size changes
    useEffect(() => {
        if (width > 0 && height > 0) {
            setThumbnails({});
        }
    }, [width, height]);

    const loadThumbnails = useCallback(async () => {
        if (!enabled || paths.length === 0) {
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // Load all thumbnails (don't filter - we cleared cache on size change)
            const response = await apiService.getBatchThumbnails(paths, width, height);

            setThumbnails(response.thumbnails);
        } catch (err) {
            setError(err instanceof Error ? err : new Error("Failed to load thumbnails"));
            console.error("Error loading thumbnails:", err);
        } finally {
            setLoading(false);
        }
    }, [paths, width, height, enabled]);

    useEffect(() => {
        loadThumbnails();
    }, [loadThumbnails]);

    return {
        thumbnails,
        loading,
        error,
        reload: loadThumbnails,
    };
}
