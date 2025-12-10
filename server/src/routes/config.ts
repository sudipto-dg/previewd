import type { FastifyInstance } from "fastify";
import fs from "node:fs";
import path from "node:path";
import type { Config } from "../types/index.js";

export default async function configRoutes(fastify: FastifyInstance) {
  const configPath = path.join(process.cwd(), "src", "config", "folders.json");

  function loadConfig(): Config {
    try {
      const configData = fs.readFileSync(configPath, "utf-8");
      return JSON.parse(configData) as Config;
    } catch (error) {
      fastify.log.error("Failed to load config:", error);
      throw new Error("Failed to load configuration");
    }
  }

  function saveConfig(config: Config): void {
    try {
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
    } catch (error) {
      fastify.log.error("Failed to save config:", error);
      throw new Error("Failed to save configuration");
    }
  }

  // GET /api/config
  fastify.get(
    "/api/config",
    {
      preHandler: [fastify.authenticate],
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
              thumbnail: { type: "object" },
              video: { type: "object" },
              pagination: { type: "object" },
            },
          },
        },
      },
    },
    async () => {
      return loadConfig();
    },
  );

  // POST /api/config
  fastify.post<{
    Body: Config;
  }>(
    "/api/config",
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: {
          type: "object",
          required: ["folders", "thumbnail", "video", "pagination"],
          properties: {
            folders: {
              type: "array",
              items: {
                type: "object",
                required: ["name", "path", "enabled"],
                properties: {
                  name: { type: "string" },
                  path: { type: "string" },
                  enabled: { type: "boolean" },
                },
              },
            },
            thumbnail: { type: "object" },
            video: { type: "object" },
            pagination: { type: "object" },
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
      try {
        saveConfig(request.body);
        return { success: true };
      } catch (error) {
        fastify.log.error("Error saving config:", error);
        return reply.status(500).send({ error: "Failed to save configuration" });
      }
    },
  );
}

