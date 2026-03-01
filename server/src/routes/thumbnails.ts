import type { FastifyInstance } from "fastify";
import type { BatchThumbnailResponse } from "../types/index.js";
import { getConfig } from "../utils/configLoader.js";
import { validatePath } from "../utils/pathValidator.js";
import { generateThumbnail } from "../utils/thumbnail.js";

export default async function thumbnailRoutes(fastify: FastifyInstance) {
    // GET /api/thumbnail
    fastify.get<{
        Querystring: {
            path: string;
            width?: string;
            height?: string;
        };
    }>(
        "/api/thumbnail",
        {
            schema: {
                querystring: {
                    type: "object",
                    required: ["path"],
                    properties: {
                        path: { type: "string" },
                        width: { type: "string" },
                        height: { type: "string" },
                    },
                },
                response: {
                    200: {
                        type: "object",
                        properties: {
                            thumbnail: { type: "string" },
                            path: { type: "string" },
                        },
                    },
                },
            },
        },
        async (request, reply) => {
            const { path: filePath } = request.query;
            const width = Number.parseInt(request.query.width || "300", 10);
            const height = Number.parseInt(request.query.height || "300", 10);

            const config = getConfig();
            const validation = validatePath(filePath, config);
            if (!validation.valid || !validation.resolvedPath) {
                return reply.status(400).send({ error: validation.error });
            }

            try {
                const thumbnail = await generateThumbnail(validation.resolvedPath, width, height);
                return {
                    thumbnail,
                    path: filePath,
                };
            } catch (error) {
                fastify.log.error("Error generating thumbnail:", error);
                return reply.status(500).send({ error: "Failed to generate thumbnail" });
            }
        }
    );

    // GET /api/thumbnails/batch
    fastify.get<{
        Querystring: {
            paths: string | string[];
            width?: string;
            height?: string;
        };
    }>(
        "/api/thumbnails/batch",
        {
            schema: {
                querystring: {
                    type: "object",
                    // Allow any properties to handle paths[] format
                    additionalProperties: true,
                },
                response: {
                    200: {
                        type: "object",
                        properties: {
                            thumbnails: { type: "object" },
                        },
                    },
                },
            },
        },
        async (request, reply) => {
            // Handle both paths and paths[] query parameter formats
            let paths: string[] = [];
            const query = request.query as Record<string, unknown>;

            // Parse raw querystring to handle multiple paths= parameters
            const rawUrl = request.url.split("?")[1] || "";

            // Check if paths appears multiple times in raw query string
            const rawPaths: string[] = [];
            if (rawUrl.includes("paths=")) {
                const pathMatches = rawUrl.match(/paths=([^&]+)/g);
                if (pathMatches) {
                    for (const match of pathMatches) {
                        const decoded = decodeURIComponent(match.replace("paths=", ""));
                        rawPaths.push(decoded);
                    }
                }
            }

            if (rawPaths.length > 0) {
                paths = rawPaths;
            } else if (Array.isArray(query.paths)) {
                paths = query.paths as string[];
            } else if (typeof query.paths === "string") {
                paths = [query.paths];
            } else if (query["paths[]"]) {
                // Handle paths[] array notation
                const pathsArray = query["paths[]"];
                paths = Array.isArray(pathsArray)
                    ? (pathsArray as string[])
                    : [pathsArray as string];
            }

            fastify.log.info({ paths, count: paths.length }, "Parsed paths");

            if (paths.length === 0) {
                return reply.status(400).send({ error: "No paths provided" });
            }

            const width = Number.parseInt((query.width as string) || "300", 10);
            const height = Number.parseInt((query.height as string) || "300", 10);

            const config = getConfig();
            const thumbnails: Record<string, string> = {};

            // Process thumbnails with concurrency limit
            const concurrencyLimit = 5;
            const chunks: string[][] = [];
            for (let i = 0; i < paths.length; i += concurrencyLimit) {
                chunks.push(paths.slice(i, i + concurrencyLimit));
            }

            for (const chunk of chunks) {
                const promises = chunk.map(async (filePath) => {
                    const validation = validatePath(filePath, config);
                    if (!validation.valid || !validation.resolvedPath) {
                        fastify.log.warn(
                            { path: filePath, error: validation.error },
                            "Path validation failed"
                        );
                        return { path: filePath, thumbnail: null };
                    }

                    try {
                        const thumbnail = await generateThumbnail(
                            validation.resolvedPath,
                            width,
                            height
                        );
                        fastify.log.info(
                            { path: filePath, thumbnailLength: thumbnail.length },
                            "Thumbnail generated"
                        );
                        return { path: filePath, thumbnail };
                    } catch (error) {
                        fastify.log.warn(
                            { err: error, path: filePath },
                            "Failed to generate thumbnail"
                        );
                        return { path: filePath, thumbnail: null };
                    }
                });

                const results = await Promise.all(promises);
                for (const result of results) {
                    if (result.thumbnail) {
                        thumbnails[result.path] = result.thumbnail;
                    } else {
                        fastify.log.warn({ path: result.path }, "No thumbnail returned");
                    }
                }
            }

            fastify.log.info(
                { thumbnailCount: Object.keys(thumbnails).length },
                "Batch thumbnails response"
            );
            const response: BatchThumbnailResponse = { thumbnails };
            return response;
        }
    );

    // GET /api/video-preview - Moved to files.ts
    // This route now serves video preview clips directly (not base64 thumbnails)
}
