import type { RunError } from "@infra-review/shared";

export type ErrorResponse = {
  error: RunError;
};

export function runNotFoundError(runId: string): RunError {
  return {
    code: "RUN_NOT_FOUND",
    message: `Run '${runId}' was not found.`,
    details: { runId }
  };
}

export function invalidCreateRunRequestError(issues: unknown): RunError {
  return {
    code: "INVALID_CREATE_RUN_REQUEST",
    message: "Request body did not match the create run contract.",
    details: { issues }
  };
}
