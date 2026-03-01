import fs from "node:fs";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import type { BrowseResponse, FileItem } from "../types/index.js";
import { DEFAULT_VIDEO_PREVIEW_DURATION, getConfig } from "../utils/configLoader.js";
import { validatePath } from "../utils/pathValidator.js";
import { generateVideoPreviewClip } from "../utils/thumbnail.js";

export default async function filesRoutes(fastify: FastifyInstance) {
    const getCurrentConfig = () => getConfig();

    // GET /api/folders
    fastify.get(
        "/api/folders",
        {
            schema: {
                response: {
                    200: {
                        type: "object",
                        properties: {
                            folders: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        name: { type: "string" },
                                        path: { type: "string" },
                                        enabled: { type: "boolean" },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        async () => {
            const config = getCurrentConfig();
            return {
                folders: config.folders.filter((f) => f.enabled),
            };
        }
    );

    // GET /api/browse
    fastify.get<{
        Querystring: {
            path: string;
            page?: string;
            limit?: string;
            sortBy?: "name" | "size" | "date" | "type";
            sortOrder?: "asc" | "desc";
        };
    }>(
        "/api/browse",
        {
            schema: {
                querystring: {
                    type: "object",
                    required: ["path"],
                    properties: {
                        path: { type: "string" },
                        page: { type: "string" },
                        limit: { type: "string" },
                        sortBy: {
                            type: "string",
                            enum: ["name", "size", "date", "type"],
                        },
                        sortOrder: { type: "string", enum: ["asc", "desc"] },
                    },
                },
                response: {
                    200: {
                        type: "object",
                        properties: {
                            items: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        name: { type: "string" },
                                        path: { type: "string" },
                                        type: { type: "string", enum: ["file", "directory"] },
                                        size: { type: "number" },
                                        modified: { type: "string" },
                                        extension: { type: "string" },
                                    },
                                },
                            },
                            total: { type: "number" },
                            page: { type: "number" },
                            limit: { type: "number" },
                            totalPages: { type: "number" },
                        },
                    },
                },
            },
        },
        async (request, reply) => {
            const config = getCurrentConfig();
            const { path: dirPath } = request.query;
            const page = Number.parseInt(request.query.page || "1", 10);
            const limit = Math.min(
                Number.parseInt(request.query.limit || String(config.pagination.defaultLimit), 10),
                config.pagination.maxLimit
            );
            const sortBy = request.query.sortBy || "name";
            const sortOrder = request.query.sortOrder || "asc";

            const validation = validatePath(dirPath, config);
            if (!validation.valid || !validation.resolvedPath) {
                return reply.status(400).send({ error: validation.error });
            }

            const resolvedPath = validation.resolvedPath;

            try {
                const stats = fs.statSync(resolvedPath);
                if (!stats.isDirectory()) {
                    return reply.status(400).send({ error: "Path is not a directory" });
                }

                const entries = fs.readdirSync(resolvedPath);
                const items: FileItem[] = [];

                for (const entry of entries) {
                    try {
                        const fullPath = path.join(resolvedPath, entry);
                        const entryStats = fs.statSync(fullPath);
                        const item: FileItem = {
                            name: entry,
                            path: fullPath,
                            type: entryStats.isDirectory() ? "directory" : "file",
                        };

                        if (entryStats.isFile()) {
                            item.size = entryStats.size;
                            item.extension = path.extname(entry).toLowerCase();
                        }

                        item.modified = entryStats.mtime.toISOString();
                        items.push(item);
                    } catch (error) {
                        // Skip files that can't be accessed
                        fastify.log.warn({ err: error, entry }, "Failed to read entry");
                    }
                }

                // Sort items
                items.sort((a, b) => {
                    let comparison = 0;

                    switch (sortBy) {
                        case "name":
                            comparison = a.name.localeCompare(b.name);
                            break;
                        case "size":
                            comparison = (a.size || 0) - (b.size || 0);
                            break;
                        case "date":
                            comparison =
                                new Date(a.modified || 0).getTime() -
                                new Date(b.modified || 0).getTime();
                            break;
                        case "type":
                            comparison = a.type.localeCompare(b.type);
                            break;
                    }

                    return sortOrder === "asc" ? comparison : -comparison;
                });

                // Paginate
                const total = items.length;
                const totalPages = Math.ceil(total / limit);
                const startIndex = (page - 1) * limit;
                const endIndex = startIndex + limit;
                const paginatedItems = items.slice(startIndex, endIndex);

                const response: BrowseResponse = {
                    items: paginatedItems,
                    total,
                    page,
                    limit,
                    totalPages,
                };

                return response;
            } catch (error) {
                fastify.log.error({ err: error }, "Error browsing directory");
                return reply.status(500).send({ error: "Failed to browse directory" });
            }
        }
    );

    // GET /api/file - Serve any file directly
    fastify.get<{
        Querystring: {
            path: string;
            token?: string;
        };
    }>(
        "/api/file",
        {
            schema: {
                querystring: {
                    type: "object",
                    required: ["path"],
                    properties: {
                        path: { type: "string" },
                        token: { type: "string" },
                    },
                },
            },
        },
        async (request, reply) => {
            // Authentication check - support both Authorization header and token query parameter
            const authHeader = request.headers.authorization;
            const tokenFromQuery = request.query.token;

            if (!authHeader && !tokenFromQuery) {
                return reply.status(401).send({ error: "Authentication required" });
            }

            // Verify token - prefer query param to avoid interfering with streaming
            let tokenToVerify: string | null = null;
            if (tokenFromQuery) {
                tokenToVerify = tokenFromQuery;
            } else if (authHeader?.startsWith("Bearer ")) {
                tokenToVerify = authHeader.substring(7);
            }

            if (tokenToVerify) {
                try {
                    await fastify.jwt.verify(tokenToVerify);
                } catch (err) {
                    fastify.log.warn({ err }, "Invalid token");
                    return reply.status(401).send({ error: "Invalid token" });
                }
            } else {
                return reply.status(401).send({ error: "Invalid authentication" });
            }

            const { path: filePath } = request.query;
            const config = getCurrentConfig();

            const validation = validatePath(filePath, config);
            if (!validation.valid || !validation.resolvedPath) {
                return reply.status(400).send({ error: validation.error });
            }

            try {
                const stats = fs.statSync(validation.resolvedPath);
                if (!stats.isFile()) {
                    return reply.status(400).send({ error: "Path is not a file" });
                }

                const ext = path.extname(validation.resolvedPath).toLowerCase();
                const fileSize = stats.size;
                const range = request.headers.range;

                // Determine content type
                const contentTypeMap: Record<string, string> = {
                    // Images
                    ".jpg": "image/jpeg",
                    ".jpeg": "image/jpeg",
                    ".png": "image/png",
                    ".gif": "image/gif",
                    ".bmp": "image/bmp",
                    ".webp": "image/webp",
                    ".svg": "image/svg+xml",
                    // Videos
                    ".mp4": "video/mp4",
                    ".webm": "video/webm",
                    ".avi": "video/x-msvideo",
                    ".mov": "video/quicktime",
                    ".mkv": "video/x-matroska",
                    ".m4v": "video/mp4",
                };
                const contentType = contentTypeMap[ext] || "application/octet-stream";

                if (range && contentType.startsWith("video/")) {
                    // Parse range header for video files
                    const parts = range.replace(/bytes=/, "").split("-");
                    const start = Number.parseInt(parts[0], 10);
                    const end = parts[1] ? Number.parseInt(parts[1], 10) : fileSize - 1;
                    const chunksize = end - start + 1;

                    // Validate range
                    if (start >= fileSize || end >= fileSize || start > end) {
                        reply.code(416).header("Content-Range", `bytes */${fileSize}`).send();
                        return;
                    }

                    const fileStream = fs.createReadStream(validation.resolvedPath, {
                        start,
                        end,
                    });

                    let requestAborted = false;

                    // Track if request was aborted (normal for video seeking)
                    request.raw.on("close", () => {
                        requestAborted = true;
                        if (!fileStream.destroyed) {
                            fileStream.destroy();
                        }
                    });

                    request.raw.on("aborted", () => {
                        requestAborted = true;
                        if (!fileStream.destroyed) {
                            fileStream.destroy();
                        }
                    });

                    // Handle stream errors
                    fileStream.on("error", (err) => {
                        // Only log errors if request wasn't aborted (abort is expected for video seeking)
                        if (!requestAborted && !reply.sent && !reply.raw.destroyed) {
                            fastify.log.warn({ err }, "File stream error");
                            reply.raw.statusCode = 500;
                            reply.raw.end(JSON.stringify({ error: "Failed to stream file" }));
                        }
                    });

                    // Handle response stream errors
                    reply.raw.on("error", (err) => {
                        // Suppress errors if request was aborted (expected for video seeking)
                        if (!requestAborted) {
                            fastify.log.warn({ err }, "Response stream error");
                        }
                    });

                    // Handle stream end
                    fileStream.on("end", () => {
                        // Stream completed successfully
                    });

                    // Send stream using reply.raw directly to bypass Fastify's stream logging
                    // This prevents "stream closed prematurely" warnings for aborted video requests
                    // which are expected behavior when users seek through videos
                    reply.raw.writeHead(206, {
                        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
                        "Accept-Ranges": "bytes",
                        "Content-Length": chunksize.toString(),
                        "Content-Type": contentType,
                    });

                    fileStream.pipe(reply.raw);
                    reply.sent = true;
                } else {
                    // Send entire file
                    const fileStream = fs.createReadStream(validation.resolvedPath);

                    fileStream.on("error", (err) => {
                        if (!reply.sent) {
                            fastify.log.warn({ err }, "File stream error");
                            reply.code(500).send({ error: "Failed to stream file" });
                        }
                    });

                    // Handle client abort
                    request.raw.on("close", () => {
                        if (!fileStream.destroyed) {
                            fileStream.destroy();
                        }
                    });

                    request.raw.on("aborted", () => {
                        if (!fileStream.destroyed) {
                            fileStream.destroy();
                        }
                    });

                    reply
                        .header("Content-Length", fileSize.toString())
                        .header("Content-Type", contentType)
                        .header(
                            "Accept-Ranges",
                            contentType.startsWith("video/") ? "bytes" : "none"
                        )
                        .send(fileStream);
                }
            } catch (error) {
                fastify.log.error({ err: error }, "Error serving file");
                return reply.status(500).send({ error: "Failed to serve file" });
            }
        }
    );

    // GET /api/video-preview - Serve video preview clip (small clipped video for thumbnails)
    fastify.get<{
        Querystring: {
            path: string;
        };
    }>(
        "/api/video-preview",
        {
            schema: {
                querystring: {
                    type: "object",
                    required: ["path"],
                    properties: {
                        path: { type: "string" },
                    },
                },
            },
        },
        async (request, reply) => {
            const { path: filePath } = request.query;
            const config = getCurrentConfig();

            const validation = validatePath(filePath, config);
            if (!validation.valid || !validation.resolvedPath) {
                return reply.status(400).send({ error: validation.error });
            }

            try {
                const stats = fs.statSync(validation.resolvedPath);
                if (!stats.isFile()) {
                    return reply.status(400).send({ error: "Path is not a file" });
                }

                // Check if it's a video file
                const videoExt = path.extname(validation.resolvedPath).toLowerCase();
                const videoExtensions = [".mp4", ".avi", ".mov", ".mkv", ".webm", ".m4v"];
                if (!videoExtensions.includes(videoExt)) {
                    return reply.status(400).send({ error: "File is not a video" });
                }

                // Generate or get cached preview clip
                const previewDuration =
                    config.video.previewDuration ?? DEFAULT_VIDEO_PREVIEW_DURATION;

                let previewPath: string;
                try {
                    fastify.log.info(
                        { path: validation.resolvedPath },
                        "Generating video preview clip"
                    );
                    // Don't pass startTime - let it calculate from middle
                    previewPath = await generateVideoPreviewClip(
                        validation.resolvedPath,
                        previewDuration
                    );

                    // Verify preview file exists and has content
                    if (!fs.existsSync(previewPath)) {
                        fastify.log.error(
                            { path: previewPath },
                            "Preview clip file was not created"
                        );
                        throw new Error("Preview clip file was not created");
                    }

                    const previewStats = fs.statSync(previewPath);
                    fastify.log.info(
                        { path: previewPath, size: previewStats.size },
                        "Preview clip generated"
                    );

                    if (previewStats.size === 0) {
                        fastify.log.warn(
                            { path: previewPath },
                            "Preview clip is empty, serving original"
                        );
                        previewPath = validation.resolvedPath;
                    }
                } catch (error) {
                    fastify.log.error(
                        { err: error, path: validation.resolvedPath },
                        "Failed to generate preview clip, serving original"
                    );
                    // Fallback to serving original video if preview generation fails
                    previewPath = validation.resolvedPath;
                }

                const finalStats = fs.statSync(previewPath);
                const fileSize = finalStats.size;

                fastify.log.info(
                    {
                        previewPath,
                        fileSize,
                        originalPath: validation.resolvedPath,
                        isPreview: previewPath !== validation.resolvedPath,
                    },
                    "Serving video preview"
                );

                if (fileSize === 0) {
                    fastify.log.error({ path: previewPath }, "Video file is empty");
                    return reply.status(500).send({ error: "Video file is empty" });
                }

                const range = request.headers.range;

                // Determine content type based on file extension
                const ext = path.extname(previewPath).toLowerCase();
                const contentTypeMap: Record<string, string> = {
                    ".mp4": "video/mp4",
                    ".webm": "video/webm",
                    ".avi": "video/x-msvideo",
                    ".mov": "video/quicktime",
                    ".mkv": "video/x-matroska",
                    ".m4v": "video/mp4",
                };
                const contentType = contentTypeMap[ext] || "video/mp4";

                if (range) {
                    // Parse range header
                    const parts = range.replace(/bytes=/, "").split("-");
                    const start = Number.parseInt(parts[0], 10);
                    const end = parts[1] ? Number.parseInt(parts[1], 10) : fileSize - 1;
                    const chunksize = end - start + 1;

                    // Validate range
                    if (start >= fileSize || end >= fileSize || start > end) {
                        reply.code(416).header("Content-Range", `bytes */${fileSize}`).send();
                        return;
                    }

                    const fileStream = fs.createReadStream(previewPath, {
                        start,
                        end,
                    });

                    fileStream.on("error", (err) => {
                        if (!reply.sent) {
                            fastify.log.warn({ err }, "Video preview stream error");
                        }
                    });

                    request.raw.on("close", () => {
                        if (!fileStream.destroyed) {
                            fileStream.destroy();
                        }
                    });

                    reply
                        .code(206)
                        .header("Content-Range", `bytes ${start}-${end}/${fileSize}`)
                        .header("Accept-Ranges", "bytes")
                        .header("Content-Length", chunksize.toString())
                        .header("Content-Type", contentType)
                        .send(fileStream);
                } else {
                    // Double-check file exists and has content before streaming
                    if (!fs.existsSync(previewPath)) {
                        fastify.log.error({ path: previewPath }, "Preview file does not exist");
                        return reply.status(500).send({ error: "Preview file not found" });
                    }

                    const verifyStats = fs.statSync(previewPath);
                    if (verifyStats.size === 0) {
                        fastify.log.error({ path: previewPath }, "Preview file is empty");
                        return reply.status(500).send({ error: "Preview file is empty" });
                    }

                    fastify.log.info(
                        {
                            path: previewPath,
                            fileSize,
                            contentType,
                        },
                        "Sending video preview stream"
                    );

                    // For small preview files, read into buffer and send directly
                    // For larger files, use streaming
                    if (fileSize < 10 * 1024 * 1024) {
                        // Less than 10MB
                        try {
                            const fileBuffer = fs.readFileSync(previewPath);
                            return reply
                                .code(200)
                                .header("Content-Type", contentType)
                                .header("Content-Length", fileSize.toString())
                                .header("Accept-Ranges", "bytes")
                                .header("Cache-Control", "public, max-age=31536000")
                                .send(fileBuffer);
                        } catch (error) {
                            fastify.log.error({ err: error }, "Failed to read preview file");
                            return reply.status(500).send({ error: "Failed to read preview file" });
                        }
                    } else {
                        // Use streaming for larger files
                        const fileStream = fs.createReadStream(previewPath);

                        fileStream.on("error", (err) => {
                            fastify.log.error(
                                { err, path: previewPath },
                                "Video preview stream error"
                            );
                            if (!reply.sent) {
                                reply.code(500).send({ error: "Failed to stream video preview" });
                            }
                        });

                        request.raw.on("close", () => {
                            if (!fileStream.destroyed) {
                                fileStream.destroy();
                            }
                        });

                        return reply
                            .code(200)
                            .header("Content-Type", contentType)
                            .header("Content-Length", fileSize.toString())
                            .header("Accept-Ranges", "bytes")
                            .header("Cache-Control", "public, max-age=31536000")
                            .send(fileStream);
                    }
                }
            } catch (error) {
                fastify.log.error({ err: error }, "Error serving video preview");
                return reply.status(500).send({ error: "Failed to serve video preview" });
            }
        }
    );
}
