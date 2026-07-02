import cors from "@fastify/cors";
import Fastify from "fastify";
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

  app.addHook("onReady", async () => {
    await runStore.load();
  });

  app.get("/health", async () => ({ ok: true }));
  app.register(registerRunRoutes, { prefix: "/runs", runStore });

  return app;
}
