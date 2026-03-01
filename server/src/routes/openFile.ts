import type { FastifyInstance } from "fastify";
import { getConfig } from "../utils/configLoader.js";
import { openFile } from "../utils/fileOpener.js";
import { validatePath } from "../utils/pathValidator.js";

export default async function openFileRoutes(fastify: FastifyInstance) {
    // POST /api/open-file
    fastify.post<{
        Body: { path: string };
    }>(
        "/api/open-file",
        {
            schema: {
                body: {
                    type: "object",
                    required: ["path"],
                    properties: {
                        path: { type: "string" },
                    },
                },
                response: {
                    200: {
                        type: "object",
                        properties: {
                            success: { type: "boolean" },
                        },
                    },
                },
            },
        },
        async (request, reply) => {
            const { path: filePath } = request.body;

            const config = getConfig();
            const validation = validatePath(filePath, config);
            if (!validation.valid || !validation.resolvedPath) {
                return reply.status(400).send({ error: validation.error });
            }

            try {
                await openFile(validation.resolvedPath);
                return { success: true };
            } catch (error) {
                fastify.log.error("Error opening file:", error);
                return reply.status(500).send({ error: "Failed to open file" });
            }
        }
    );
}
