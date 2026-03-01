import fs from "node:fs";
import path from "node:path";
import type { Config } from "../types/index.js";

export function validatePath(
    filePath: string,
    config: Config
): { valid: boolean; resolvedPath?: string; error?: string } {
    try {
        // Resolve the path to prevent directory traversal
        const resolvedPath = path.resolve(filePath);

        // Check if path is within any configured folder
        const isWithinConfig = config.folders.some((folder) => {
            if (!folder.enabled) return false;
            const folderPath = path.resolve(folder.path);
            return resolvedPath.startsWith(folderPath);
        });

        if (!isWithinConfig) {
            return {
                valid: false,
                error: "Path is not within configured folders",
            };
        }

        // Check if path exists
        if (!fs.existsSync(resolvedPath)) {
            return {
                valid: false,
                error: "Path does not exist",
            };
        }

        return {
            valid: true,
            resolvedPath,
        };
    } catch (error) {
        return {
            valid: false,
            error: error instanceof Error ? error.message : "Invalid path",
        };
    }
}

export function sanitizePath(filePath: string): string {
    // Remove any directory traversal attempts
    return path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, "");
}
