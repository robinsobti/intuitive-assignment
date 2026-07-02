import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply } from "fastify";
import {
  CreateRunRequestSchema,
  type CreateRunResponse,
  type GetRunEventsResponse,
  type GetRunResultResponse,
  type GetRunResponse,
  type ListRunsResponse,
  type Run,
  type RunError
} from "@infra-review/shared";

type RunParams = {
  runId: string;
};

type ErrorResponse = {
  error: RunError;
};

const runs: Run[] = [];

function sendRunNotFound(reply: FastifyReply, runId: string) {
  const error = {
    code: "RUN_NOT_FOUND",
    message: `Run '${runId}' was not found.`,
    details: { runId }
  } satisfies RunError;

  return reply.code(404).send({ error } satisfies ErrorResponse);
}

export async function registerRunRoutes(app: FastifyInstance) {
  app.get("/", async (): Promise<ListRunsResponse> => ({ runs }));

  app.post("/", async (request, reply) => {
    const parsedRequest = CreateRunRequestSchema.safeParse(request.body);

    if (!parsedRequest.success) {
      const error = {
        code: "INVALID_CREATE_RUN_REQUEST",
        message: "Request body did not match the create run contract.",
        details: { issues: parsedRequest.error.issues }
      } satisfies RunError;

      return reply.code(400).send({ error } satisfies ErrorResponse);
    }

    const now = new Date().toISOString();
    const run = {
      id: randomUUID(),
      name: parsedRequest.data.name,
      source: parsedRequest.data.source,
      status: "QUEUED",
      currentStep: "RECEIVED_INPUT",
      createdAt: now,
      updatedAt: now
    } satisfies Run;

    return reply.code(202).send({ run } satisfies CreateRunResponse);
  });

  app.get<{ Params: RunParams }>(
    "/:runId",
    async (request, reply): Promise<GetRunResponse | undefined> => {
      return sendRunNotFound(reply, request.params.runId);
    }
  );

  app.get<{ Params: RunParams }>(
    "/:runId/events",
    async (request, reply): Promise<GetRunEventsResponse | undefined> => {
      return sendRunNotFound(reply, request.params.runId);
    }
  );

  app.get<{ Params: RunParams }>(
    "/:runId/result",
    async (request, reply): Promise<GetRunResultResponse | undefined> => {
      return sendRunNotFound(reply, request.params.runId);
    }
  );
}
