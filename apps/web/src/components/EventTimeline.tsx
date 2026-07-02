import type { RunEvent, RunStatus } from "@infra-review/shared";
import {
  formatDateTime,
  formatRunStatus,
  formatWorkflowStep
} from "../lib/formatting";
import { EmptyState } from "./EmptyState";
import { StatusBadge, type StatusBadgeTone } from "./StatusBadge";

type EventTimelineProps = {
  events: RunEvent[];
};

export function EventTimeline({ events }: EventTimelineProps) {
  const sortedEvents = [...events].sort(
    (left, right) =>
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
  );

  if (sortedEvents.length === 0) {
    return (
      <EmptyState
        description="Workflow events will appear here as soon as the API records them."
        title="No events recorded"
      />
    );
  }

  return (
    <ol className="event-timeline" aria-label="Workflow event timeline">
      {sortedEvents.map((event) => (
        <li className="event-item" key={event.id}>
          <time className="event-item__time" dateTime={event.createdAt}>
            {formatDateTime(event.createdAt)}
          </time>
          <StatusBadge tone={toneForRunStatus(event.status)}>
            {formatRunStatus(event.status)}
          </StatusBadge>
          <span className="event-item__step">
            {formatWorkflowStep(event.step)}
          </span>
          <p>{event.message}</p>
        </li>
      ))}
    </ol>
  );
}

function toneForRunStatus(status: RunStatus): StatusBadgeTone {
  switch (status) {
    case "QUEUED":
      return "neutral";
    case "RUNNING":
      return "info";
    case "SUCCEEDED":
      return "success";
    case "FAILED":
      return "danger";
  }
}
