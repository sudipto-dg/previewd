import fs from "node:fs";
import path from "node:path";
import type { Config } from "../types/index.js";

let cachedConfig: Config | null = null;

export function getConfig(): Config {
  if (cachedConfig) {
    return cachedConfig;
  }

  const configPath = path.join(process.cwd(), "src", "config", "folders.json");

  try {
    const configData = fs.readFileSync(configPath, "utf-8");
    cachedConfig = JSON.parse(configData) as Config;
    return cachedConfig;
  } catch (error) {
    // Return default config if file doesn't exist
    return {
      folders: [],
      thumbnail: {
        maxWidth: 300,
        maxHeight: 300,
        quality: 80,
        cache: { enabled: true, ttl: 86400, maxSize: 1000 },
      },
      video: {
        previewDuration: 15,
        loop: true,
        thumbnailTime: 1,
      },
      pagination: { defaultLimit: 50, maxLimit: 200 },
    };
  }
}

export function reloadConfig(): void {
  cachedConfig = null;
  getConfig();
}

