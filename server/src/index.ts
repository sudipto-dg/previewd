import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import authPlugin from "./plugins/auth.js";
import filesRoutes from "./routes/files.js";
import configRoutes from "./routes/config.js";
import thumbnailRoutes from "./routes/thumbnails.js";
import openFileRoutes from "./routes/openFile.js";
import { pregenerateVideoPreviews } from "./utils/videoPreviewGenerator.js";

async function startServer() {
  const server = Fastify({
    logger: true,
  });

  // Register plugins
  await server.register(cors, {
    origin: true,
    credentials: true,
  });

  await server.register(jwt, {
    secret: process.env.JWT_SECRET || "your-secret-key-change-in-production",
  });

  await server.register(authPlugin, {
    username: process.env.AUTH_USERNAME || "sdg",
    password: process.env.AUTH_PASSWORD || "sdg$$",
  });

  // Register routes
  await server.register(filesRoutes);
  await server.register(configRoutes);
  await server.register(thumbnailRoutes);
  await server.register(openFileRoutes);

  // Health check
  server.get("/health", async () => {
    return { status: "ok" };
  });

  // Pre-generate video previews for configured folders (in background)
  const pregeneratePreviews = async () => {
    server.log.info("Starting video preview pre-generation...");
    const startTime = Date.now();

    try {
      await pregenerateVideoPreviews((folder, current, total) => {
        if (current % 10 === 0 || current === total) {
          server.log.info(
            { folder, progress: `${current}/${total}` },
            "Video preview generation progress",
          );
        }
      });

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      server.log.info(
        { duration: `${duration}s` },
        "Video preview pre-generation completed",
      );
    } catch (error) {
      server.log.error({ err: error }, "Error during video preview pre-generation");
    }
  };

  // Start pre-generation in background (don't block server startup)
  // pregeneratePreviews().catch((err) => {
  //   server.log.error({ err }, "Error during video preview pre-generation");
  // });

  // Start server
  const port = parseInt(process.env.SERVER_PORT || "3000", 10);
  const host = process.env.SERVER_HOST || "0.0.0.0";

  try {
    await server.listen({ port, host });
    server.log.info(`Server listening on http://${host}:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

