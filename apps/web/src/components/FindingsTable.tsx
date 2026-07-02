import type {
  Finding,
  ResourceChangeAction,
  Severity
} from "@infra-review/shared";
import { EmptyState } from "./EmptyState";
import {
  formatPolicyId,
  formatResourceChangeAction,
  formatSeverity
} from "../lib/formatting";

type FindingsTableProps = {
  findings: Finding[];
};

const severityRank: Record<Severity, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1
};

export function FindingsTable({ findings }: FindingsTableProps) {
  const sortedFindings = [...findings].sort(compareFindings);

  if (sortedFindings.length === 0) {
    return (
      <EmptyState
        description="No policy findings were recorded for this review."
        title="No findings"
      />
    );
  }

  return (
    <div className="table-scroll">
      <table className="data-table findings-table">
        <thead>
          <tr>
            <th>Severity</th>
            <th>Check</th>
            <th>Resource</th>
            <th>Action</th>
            <th>Explanation</th>
            <th>Suggested remediation</th>
          </tr>
        </thead>
        <tbody>
          {sortedFindings.map((finding) => {
            const metadata = getRecord(finding.metadata);
            const severityClass = `severity--${finding.severity.toLowerCase()}`;
            const action = getResourceAction(metadata.action);

            return (
              <tr className={severityClass} key={finding.id}>
                <td data-label="Severity">
                  <span className={`severity-pill ${severityClass}`}>
                    {formatSeverity(finding.severity)}
                  </span>
                </td>
                <td data-label="Check">
                  {getString(metadata.checkId) ??
                    formatPolicyId(finding.policyId)}
                </td>
                <td data-label="Resource">
                  {finding.resourceAddress ?? "Not available"}
                </td>
                <td data-label="Action">
                  {action === undefined
                    ? "Not available"
                    : formatResourceChangeAction(action)}
                </td>
                <td data-label="Explanation">
                  {getString(metadata.explanation) ?? finding.description}
                </td>
                <td data-label="Suggested remediation">
                  {getString(metadata.remediation) ?? "Review the finding."}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function compareFindings(left: Finding, right: Finding) {
  const severityDifference =
    severityRank[right.severity] - severityRank[left.severity];

  if (severityDifference !== 0) {
    return severityDifference;
  }

  return left.id.localeCompare(right.id);
}

function getResourceAction(value: unknown): ResourceChangeAction | undefined {
  switch (value) {
    case "create":
    case "CREATE":
      return "CREATE";
    case "update":
    case "UPDATE":
      return "UPDATE";
    case "delete":
    case "DELETE":
      return "DELETE";
    case "replace":
    case "REPLACE":
      return "REPLACE";
    case "read":
    case "READ":
      return "READ";
    case "no-op":
    case "NO_OP":
      return "NO_OP";
    default:
      return undefined;
  }
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() !== ""
    ? value
    : undefined;
}

function getRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}
