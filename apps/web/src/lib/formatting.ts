import type {
  Recommendation,
  ResourceChangeAction,
  RiskLevel,
  RunStatus,
  Severity,
  WorkflowStep
} from "@infra-review/shared";

const severityLabels: Record<Severity, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical"
};

const riskLevelLabels: Record<RiskLevel, string> = {
  LOW: "Low risk",
  MEDIUM: "Medium risk",
  HIGH: "High risk",
  CRITICAL: "Critical risk"
};

const recommendationLabels: Record<Recommendation, string> = {
  APPROVE: "Approve",
  REVIEW: "Review",
  BLOCK: "Block"
};

const runStatusLabels: Record<RunStatus, string> = {
  QUEUED: "Queued",
  RUNNING: "Running",
  SUCCEEDED: "Succeeded",
  FAILED: "Failed"
};

const resourceChangeActionLabels: Record<ResourceChangeAction, string> = {
  CREATE: "Create",
  UPDATE: "Update",
  DELETE: "Delete",
  REPLACE: "Replace",
  READ: "Read",
  NO_OP: "No-op"
};

export function formatDateTime(value: string | undefined) {
  if (value === undefined) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

export function formatSeverity(value: Severity) {
  return severityLabels[value];
}

export function formatRiskLevel(value: RiskLevel) {
  return riskLevelLabels[value];
}

export function formatRecommendation(value: Recommendation) {
  return recommendationLabels[value];
}

export function formatRunStatus(value: RunStatus) {
  return runStatusLabels[value];
}

export function formatWorkflowStep(value: WorkflowStep) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatResourceChangeAction(value: ResourceChangeAction) {
  return resourceChangeActionLabels[value];
}

export function formatPolicyId(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
