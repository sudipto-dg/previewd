import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "thumbnailSize";
const MIN_SIZE = 100;
const MAX_SIZE = 1000;
const DEFAULT_SIZE = 200;

export function useThumbnailSize() {
    const [size, setSize] = useState(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = Number.parseInt(stored, 10);
            if (parsed >= MIN_SIZE && parsed <= MAX_SIZE) {
                return parsed;
            }
        }
        return DEFAULT_SIZE;
    });

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, String(size));
    }, [size]);

    // Listen for storage changes (e.g., from other tabs/components)
    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === STORAGE_KEY && e.newValue) {
                const parsed = Number.parseInt(e.newValue, 10);
                if (parsed >= MIN_SIZE && parsed <= MAX_SIZE) {
                    setSize(parsed);
                }
            }
        };

        window.addEventListener("storage", handleStorageChange);
        return () => window.removeEventListener("storage", handleStorageChange);
    }, []);

    const setThumbnailSize = useCallback((newSize: number) => {
        const clampedSize = Math.max(MIN_SIZE, Math.min(MAX_SIZE, newSize));
        setSize(clampedSize);
    }, []);

    return {
        size,
        setSize: setThumbnailSize,
        minSize: MIN_SIZE,
        maxSize: MAX_SIZE,
    };
}
