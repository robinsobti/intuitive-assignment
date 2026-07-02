import type { FastifyPluginAsync, FastifyReply } from "fastify";
import {
  CreateRunRequestSchema,
  type CreateRunResponse,
  type GetRunEventsResponse,
  type GetRunResultResponse,
  type GetRunResponse,
  type ListRunsResponse
} from "@infra-review/shared";
import {
  invalidCreateRunRequestError,
  runNotFoundError,
  type ErrorResponse
} from "../lib/errors.js";
import type { RunStore } from "../storage/types.js";
import {
  startReviewWorkflow,
  type StartReviewWorkflow
} from "../workflow/runner.js";

type RunParams = {
  runId: string;
};

type RunRoutesOptions = {
  runStore: RunStore;
  startWorkflow?: StartReviewWorkflow;
};

function sendRunNotFound(reply: FastifyReply, runId: string) {
  return reply
    .code(404)
    .send({ error: runNotFoundError(runId) } satisfies ErrorResponse);
}

export const registerRunRoutes: FastifyPluginAsync<RunRoutesOptions> = async (
  app,
  { runStore, startWorkflow = startReviewWorkflow }
) => {
  app.get("/", async (): Promise<ListRunsResponse> => ({
    runs: await runStore.listRuns()
  }));

  app.post("/", async (request, reply) => {
    const parsedRequest = CreateRunRequestSchema.safeParse(request.body);

    if (!parsedRequest.success) {
      const error = invalidCreateRunRequestError(parsedRequest.error.issues);

      return reply.code(400).send({ error } satisfies ErrorResponse);
    }

    const run = await runStore.createRun(parsedRequest.data);
    setImmediate(() => {
      void startWorkflow({ runId: run.id, runStore, logger: app.log });
    });

    return reply.code(202).send({ run } satisfies CreateRunResponse);
  });

  app.get<{ Params: RunParams }>(
    "/:runId",
    async (request, reply): Promise<GetRunResponse | undefined> => {
      const run = await runStore.getRun(request.params.runId);

      if (run === null) {
        return sendRunNotFound(reply, request.params.runId);
      }

      return { run };
    }
  );

  app.get<{ Params: RunParams }>(
    "/:runId/events",
    async (request, reply): Promise<GetRunEventsResponse | undefined> => {
      const run = await runStore.getRun(request.params.runId);

      if (run === null) {
        return sendRunNotFound(reply, request.params.runId);
      }

      return { events: await runStore.getEvents(run.id) };
    }
  );

  app.get<{ Params: RunParams }>(
    "/:runId/result",
    async (request, reply): Promise<GetRunResultResponse | undefined> => {
      const run = await runStore.getRun(request.params.runId);

      if (run === null) {
        return sendRunNotFound(reply, request.params.runId);
      }

      return {
        status: run.status,
        result: await runStore.getResult(run.id)
      };
    }
  );

  app.delete<{ Params: RunParams }>("/:runId", async (request, reply) => {
    const deleted = await runStore.deleteRun(request.params.runId);

    if (!deleted) {
      return sendRunNotFound(reply, request.params.runId);
    }

    return reply.code(204).send();
  });
};
