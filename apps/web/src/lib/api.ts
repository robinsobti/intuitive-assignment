import type {
  CreateRunRequest,
  CreateRunResponse,
  GetRunEventsResponse,
  GetRunResponse,
  GetRunResultResponse,
  ListRunsResponse,
  RunError
} from "@infra-review/shared";

export const API_BASE_URL = normalizeBaseUrl(
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000"
);

type ErrorResponse = {
  error?: RunError;
};

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export function createRun(
  input: CreateRunRequest
): Promise<CreateRunResponse> {
  return requestJson<CreateRunResponse>("/runs", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function listRuns(): Promise<ListRunsResponse> {
  return requestJson<ListRunsResponse>("/runs");
}

export function getRun(runId: string): Promise<GetRunResponse> {
  return requestJson<GetRunResponse>(`/runs/${encodeURIComponent(runId)}`);
}

export function getRunEvents(runId: string): Promise<GetRunEventsResponse> {
  return requestJson<GetRunEventsResponse>(
    `/runs/${encodeURIComponent(runId)}/events`
  );
}

export function getRunResult(runId: string): Promise<GetRunResultResponse> {
  return requestJson<GetRunResultResponse>(
    `/runs/${encodeURIComponent(runId)}/result`
  );
}

export async function deleteRun(runId: string): Promise<void> {
  await requestJson<void>(`/runs/${encodeURIComponent(runId)}`, {
    method: "DELETE"
  });
}

export function getApiErrorMessage(error: unknown) {
  if (error instanceof ApiClientError) {
    return error.code === undefined
      ? error.message
      : `${error.code}: ${error.message}`;
  }

  if (error instanceof TypeError) {
    return `Could not reach the API at ${API_BASE_URL}. Make sure the API server is running and accessible.`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "An unknown error occurred.";
}

async function requestJson<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const headers = new Headers(init.headers);

  if (init.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store"
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = await parseJsonResponse(response);

  if (!response.ok) {
    const error = isErrorResponse(payload) ? payload.error : undefined;

    throw new ApiClientError(
      error?.message ?? `Request failed with status ${response.status}.`,
      response.status,
      error?.code,
      error?.details
    );
  }

  return payload as T;
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();

  if (text.trim() === "") {
    return undefined;
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new ApiClientError(
      "The API returned a response that was not valid JSON.",
      response.status
    );
  }
}

function isErrorResponse(value: unknown): value is ErrorResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof value.error === "object" &&
    value.error !== null
  );
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/g, "");
}
