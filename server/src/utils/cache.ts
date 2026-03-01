import NodeCache from "node-cache";
import { getConfig } from "./configLoader.js";

let thumbnailCache: NodeCache | null = null;

export function getCache(): NodeCache {
    if (thumbnailCache) {
        return thumbnailCache;
    }

    const config = getConfig();
    const cacheConfig = config.thumbnail.cache;

    thumbnailCache = new NodeCache({
        stdTTL: cacheConfig.ttl,
        maxKeys: cacheConfig.maxSize,
        useClones: false,
    });

    return thumbnailCache;
}

export function getCacheKey(filePath: string, width: number, height: number): string {
    return `${filePath}:${width}x${height}`;
}

export function clearCache(): void {
    if (thumbnailCache) {
        thumbnailCache.flushAll();
    }
}
