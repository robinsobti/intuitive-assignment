import type {
  ResourceChange,
  ResourceChangeAction
} from "@infra-review/shared";
import { EmptyState } from "./EmptyState";
import { formatResourceChangeAction } from "../lib/formatting";

type ResourceChangesTableProps = {
  changes: ResourceChange[];
};

export function ResourceChangesTable({ changes }: ResourceChangesTableProps) {
  if (changes.length === 0) {
    return (
      <EmptyState
        description="This review did not include any normalized resource changes."
        title="No resource changes"
      />
    );
  }

  return (
    <div className="table-scroll">
      <table className="data-table resource-changes-table">
        <thead>
          <tr>
            <th>Action</th>
            <th>Resource address</th>
            <th>Type</th>
            <th>Environment</th>
            <th>Owner</th>
            <th>Service</th>
          </tr>
        </thead>
        <tbody>
          {changes.map((change) => {
            const tags = getTags(change);
            const actionClass = getActionClass(change.action);

            return (
              <tr className={actionClass} key={change.address}>
                <td data-label="Action">
                  <span className={`action-pill ${actionClass}`}>
                    {formatResourceChangeAction(change.action)}
                  </span>
                </td>
                <td data-label="Resource address">{change.address}</td>
                <td data-label="Type">{change.type}</td>
                <td data-label="Environment">{tags.environment}</td>
                <td data-label="Owner">{tags.owner}</td>
                <td data-label="Service">{tags.service}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function getActionClass(action: ResourceChangeAction) {
  return `action--${action.toLowerCase().replace("_", "-")}`;
}

function getTags(change: ResourceChange) {
  const metadata = getRecord(change.metadata);
  const tags = getRecord(metadata.tags);

  return {
    environment: getString(tags.environment) ?? "Not tagged",
    owner: getString(tags.owner) ?? "Not tagged",
    service: getString(tags.service) ?? "Not tagged"
  };
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
