"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  GetRunResultResponse,
  Run,
  RunEvent,
  RunResult,
  RunStatus
} from "@infra-review/shared";
import { ErrorCallout } from "../../../components/ErrorCallout";
import { EventTimeline } from "../../../components/EventTimeline";
import { ProgressStepper } from "../../../components/ProgressStepper";
import {
  StatusBadge,
  type StatusBadgeTone
} from "../../../components/StatusBadge";
import {
  ApiClientError,
  getApiErrorMessage,
  getRun,
  getRunEvents,
  getRunResult
} from "../../../lib/api";
import {
  formatDateTime,
  formatRecommendation,
  formatRiskLevel,
  formatRunStatus,
  formatWorkflowStep
} from "../../../lib/formatting";

const pollIntervalMs = 1000;

export default function RunDetailPage() {
  const params = useParams<{ id: string }>();
  const runId = params.id;
  const [run, setRun] = useState<Run | null>(null);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [resultResponse, setResultResponse] =
    useState<GetRunResultResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorTitle, setErrorTitle] = useState("Could not load run");

  const loadRunState = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!silent) {
        setIsLoading(true);
      }

      try {
        const [runResponse, eventsResponse, result] = await Promise.all([
          getRun(runId),
          getRunEvents(runId),
          getRunResult(runId)
        ]);

        setRun(runResponse.run);
        setEvents(eventsResponse.events);
        setResultResponse(result);
        setError(null);
      } catch (unknownError) {
        setErrorTitle(
          unknownError instanceof ApiClientError && unknownError.status === 404
            ? "Run not found"
            : "Could not load run"
        );
        setError(getApiErrorMessage(unknownError));
      } finally {
        if (!silent) {
          setIsLoading(false);
        }
      }
    },
    [runId]
  );

  useEffect(() => {
    void loadRunState();
  }, [loadRunState]);

  useEffect(() => {
    if (run === null || !isActiveRun(run)) {
      return;
    }

    const interval = window.setInterval(() => {
      void loadRunState({ silent: true });
    }, pollIntervalMs);

    return () => window.clearInterval(interval);
  }, [loadRunState, run]);

  const result = resultResponse?.result ?? null;
  const failedMessage = useMemo(
    () => getFailureMessage(resultResponse, events),
    [events, resultResponse]
  );

  return (
    <main className="workspace">
      <header className="detail-header">
        <Link className="button button--secondary" href="/">
          Back to dashboard
        </Link>
        {run === null ? null : (
          <StatusBadge tone={toneForRunStatus(run.status)}>
            {formatRunStatus(run.status)}
          </StatusBadge>
        )}
      </header>

      {isLoading && run === null ? (
        <div className="loading-row">Loading run...</div>
      ) : null}

      {error !== null && run === null ? (
        <ErrorCallout
          action={
            <button
              className="button button--secondary"
              onClick={() => void loadRunState()}
              type="button"
            >
              Retry
            </button>
          }
          message={error}
          title={errorTitle}
        />
      ) : null}

      {run === null ? null : (
        <div className="detail-grid">
          <section className="panel detail-summary" aria-labelledby="run-heading">
            <div className="panel-heading">
              <div>
                <p className="section-kicker">Review run</p>
                <h1 id="run-heading">{run.name ?? "Untitled review"}</h1>
              </div>
              <StatusBadge tone={toneForRunStatus(run.status)}>
                {formatRunStatus(run.status)}
              </StatusBadge>
            </div>

            <dl className="detail-meta">
              <div>
                <dt>Run ID</dt>
                <dd>{run.id}</dd>
              </div>
              <div>
                <dt>Source</dt>
                <dd>{run.source}</dd>
              </div>
              <div>
                <dt>Current step</dt>
                <dd>{formatWorkflowStep(run.currentStep)}</dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd>{formatDateTime(run.createdAt)}</dd>
              </div>
              <div>
                <dt>Started</dt>
                <dd>{formatDateTime(run.startedAt)}</dd>
              </div>
              <div>
                <dt>Completed</dt>
                <dd>{formatDateTime(run.completedAt)}</dd>
              </div>
            </dl>

            {run.status === "FAILED" ? (
              <ErrorCallout
                message={failedMessage}
                title="Review workflow failed"
              />
            ) : null}
          </section>

          <section className="panel" aria-labelledby="progress-heading">
            <div className="panel-heading">
              <div>
                <p className="section-kicker">Workflow</p>
                <h2 id="progress-heading">Progress</h2>
              </div>
              <span className="muted-text">
                {isActiveRun(run) ? "Polling every second" : "Polling stopped"}
              </span>
            </div>
            <ProgressStepper
              currentStep={run.currentStep}
              events={events}
              status={run.status}
            />
          </section>

          <section className="panel" aria-labelledby="result-heading">
            <div className="panel-heading">
              <div>
                <p className="section-kicker">Result</p>
                <h2 id="result-heading">Risk summary</h2>
              </div>
            </div>
            {result === null ? (
              <p className="muted-text">Result has not been written yet.</p>
            ) : (
              <RunResultSummary result={result} />
            )}
          </section>

          <section className="panel detail-events" aria-labelledby="events-heading">
            <div className="panel-heading">
              <div>
                <p className="section-kicker">Events</p>
                <h2 id="events-heading">Timeline</h2>
              </div>
            </div>
            <EventTimeline events={events} />
          </section>
        </div>
      )}
    </main>
  );
}

function RunResultSummary({ result }: { result: RunResult }) {
  return (
    <div className="result-summary">
      <div className="result-score">
        <span>Risk score</span>
        <strong>{result.riskScore}</strong>
        <p>{formatRiskLevel(result.riskLevel)}</p>
      </div>
      <dl className="result-details">
        <div>
          <dt>Recommendation</dt>
          <dd>{formatRecommendation(result.recommendation)}</dd>
        </div>
        <div>
          <dt>Findings</dt>
          <dd>{result.findings.length}</dd>
        </div>
        <div>
          <dt>Changes</dt>
          <dd>{result.summary.total}</dd>
        </div>
        <div>
          <dt>Generated</dt>
          <dd>{formatDateTime(result.generatedAt)}</dd>
        </div>
      </dl>
      <dl className="severity-counts">
        <div>
          <dt>Critical</dt>
          <dd>{result.severityCounts.CRITICAL}</dd>
        </div>
        <div>
          <dt>High</dt>
          <dd>{result.severityCounts.HIGH}</dd>
        </div>
        <div>
          <dt>Medium</dt>
          <dd>{result.severityCounts.MEDIUM}</dd>
        </div>
        <div>
          <dt>Low</dt>
          <dd>{result.severityCounts.LOW}</dd>
        </div>
      </dl>
    </div>
  );
}

function isActiveRun(run: Run) {
  return run.status === "QUEUED" || run.status === "RUNNING";
}

function getFailureMessage(
  resultResponse: GetRunResultResponse | null,
  events: RunEvent[]
) {
  if (resultResponse?.error !== undefined) {
    return resultResponse.error.message;
  }

  const failedEvent = [...events]
    .reverse()
    .find((event) => event.status === "FAILED");

  return (
    failedEvent?.message ??
    "The review workflow failed. Check the event timeline for details."
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
