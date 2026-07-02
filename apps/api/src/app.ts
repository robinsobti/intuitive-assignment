import cors from "@fastify/cors";
import Fastify from "fastify";
import { registerRunRoutes } from "./routes/runs.js";

export function buildApp() {
  const app = Fastify();

  app.register(cors, {
    origin: "http://localhost:3000"
  });

  app.get("/health", async () => ({ ok: true }));
  app.register(registerRunRoutes, { prefix: "/runs" });

  return app;
}
