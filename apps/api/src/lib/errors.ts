import type { RunError, RunEvent, WorkflowStep } from "@infra-review/shared";
import { TerraformPlanError } from "../analyzer/terraformPlan.js";

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

export function badRequestError(): RunError {
  return {
    code: "BAD_REQUEST",
    message: "Request body could not be parsed or was invalid JSON."
  };
}

export function routeNotFoundError(method: string, url: string): RunError {
  return {
    code: "ROUTE_NOT_FOUND",
    message: `No API route matched ${method} ${url}.`,
    details: { method, url }
  };
}

export function unexpectedApiError(): RunError {
  return {
    code: "INTERNAL_SERVER_ERROR",
    message: "An unexpected API error occurred."
  };
}

export function workflowErrorFromUnknown(
  error: unknown,
  step?: WorkflowStep
): RunError {
  if (error instanceof TerraformPlanError) {
    return {
      code: error.code,
      message: error.message,
      ...(step === undefined ? {} : { step }),
      details: { name: error.name }
    };
  }

  if (error instanceof Error) {
    return {
      code: "WORKFLOW_FAILED",
      message: "Review workflow failed unexpectedly.",
      ...(step === undefined ? {} : { step }),
      details: { name: error.name }
    };
  }

  return {
    code: "WORKFLOW_FAILED",
    message: "Review workflow failed unexpectedly.",
    ...(step === undefined ? {} : { step })
  };
}

export function failedRunErrorFromEvents(events: RunEvent[]): RunError {
  const failedEvent = [...events]
    .reverse()
    .find((event) => event.status === "FAILED");
  const eventError = getRecord(failedEvent?.metadata)?.error;

  if (isRunErrorLike(eventError)) {
    return sanitizeRunError(eventError, failedEvent?.step);
  }

  return {
    code: "WORKFLOW_FAILED",
    message:
      failedEvent?.message.replace(/^ERROR:\s*/, "") ??
      "Review workflow failed.",
    ...(failedEvent?.step === undefined ? {} : { step: failedEvent.step })
  };
}

function sanitizeRunError(
  error: {
    code: string;
    message: string;
    step?: unknown;
    details?: unknown;
  },
  fallbackStep: WorkflowStep | undefined
): RunError {
  const step = isWorkflowStep(error.step) ? error.step : fallbackStep;
  const details = sanitizeDetails(error.details);

  return {
    code: error.code,
    message: error.message,
    ...(step === undefined ? {} : { step }),
    ...(details === undefined ? {} : { details })
  };
}

function sanitizeDetails(details: unknown) {
  const record = getRecord(details);

  if (record === undefined) {
    return undefined;
  }

  const sanitizedEntries = Object.entries(record).filter(
    ([key]) => key.toLowerCase() !== "stack"
  );

  return sanitizedEntries.length === 0
    ? undefined
    : Object.fromEntries(sanitizedEntries);
}

function isRunErrorLike(
  value: unknown
): value is { code: string; message: string; step?: unknown; details?: unknown } {
  const record = getRecord(value);

  return (
    record !== undefined &&
    typeof record.code === "string" &&
    typeof record.message === "string"
  );
}

function getRecord(value: unknown) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function isWorkflowStep(value: unknown): value is WorkflowStep {
  return (
    value === "RECEIVED_INPUT" ||
    value === "VALIDATING_PLAN" ||
    value === "PARSING_CHANGES" ||
    value === "RUNNING_POLICY_CHECKS" ||
    value === "CALCULATING_RISK" ||
    value === "WRITING_REPORT" ||
    value === "COMPLETED" ||
    value === "FAILED"
  );
}
