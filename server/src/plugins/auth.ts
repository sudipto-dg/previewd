import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import bcrypt from "bcrypt";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<void>;
  }
}

interface AuthPluginOptions {
  username: string;
  password: string;
}

async function authPlugin(
  fastify: FastifyInstance,
  options: AuthPluginOptions,
) {
  const { username, password } = options;

  // Hash password for comparison
  const hashedPassword = await bcrypt.hash(password, 10);

  fastify.decorate(
    "authenticate",
    async function (request: FastifyRequest, reply: FastifyReply) {
      try {
        await request.jwtVerify();
      } catch (err) {
        reply.send(err);
      }
    },
  );

  // Login endpoint handler
  fastify.post<{
    Body: { username: string; password: string };
  }>(
    "/api/login",
    {
      schema: {
        body: {
          type: "object",
          required: ["username", "password"],
          properties: {
            username: { type: "string" },
            password: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              token: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { username: reqUsername, password: reqPassword } = request.body;

      if (
        reqUsername !== username ||
        !(await bcrypt.compare(reqPassword, hashedPassword))
      ) {
        return reply.status(401).send({ error: "Invalid credentials" });
      }

      const token = fastify.jwt.sign({ username });

      return { token };
    },
  );
}

export default fp(authPlugin, {
  name: "auth-plugin",
});

