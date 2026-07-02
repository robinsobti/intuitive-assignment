import cors from "@fastify/cors";
import Fastify from "fastify";
import {
  badRequestError,
  routeNotFoundError,
  unexpectedApiError,
  type ErrorResponse
} from "./lib/errors.js";
import { registerRunRoutes } from "./routes/runs.js";
import { JsonRunStore } from "./storage/jsonRunStore.js";
import type { RunStore } from "./storage/types.js";

type BuildAppOptions = {
  runStore?: RunStore;
};

export function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify();
  const runStore = options.runStore ?? new JsonRunStore();

  app.register(cors, {
    origin: "http://localhost:3000"
  });

  app.setNotFoundHandler((request, reply) => {
    return reply.code(404).send({
      error: routeNotFoundError(request.method, request.url)
    } satisfies ErrorResponse);
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ error }, "Unhandled API error");

    const statusCode = getClientErrorStatusCode(error) ?? 500;
    const apiError = statusCode === 400 ? badRequestError() : unexpectedApiError();

    return reply.code(statusCode).send({ error: apiError } satisfies ErrorResponse);
  });

  app.addHook("onReady", async () => {
    await runStore.load();
  });

  app.get("/health", async () => ({ ok: true }));
  app.register(registerRunRoutes, { prefix: "/runs", runStore });

  return app;
}

function getClientErrorStatusCode(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof error.statusCode === "number" &&
    error.statusCode >= 400 &&
    error.statusCode < 500
  ) {
    return error.statusCode;
  }

  return undefined;
}
