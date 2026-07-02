"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { APP_NAME, type Run, type RunStatus } from "@infra-review/shared";
import { EmptyState } from "../components/EmptyState";
import { ErrorCallout } from "../components/ErrorCallout";
import { StatusBadge, type StatusBadgeTone } from "../components/StatusBadge";
import {
  API_BASE_URL,
  ApiClientError,
  createRun,
  deleteRun,
  listRuns
} from "../lib/api";
import {
  formatDateTime,
  formatRunStatus,
  formatWorkflowStep
} from "../lib/formatting";

const POLL_INTERVAL_MS = 2500;

export default function HomePage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRuns = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!silent) {
        setIsLoading(true);
      }

      try {
        const response = await listRuns();
        setRuns(response.runs);
        setError(null);
      } catch (unknownError) {
        setError(formatError(unknownError));
      } finally {
        if (!silent) {
          setIsLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  useEffect(() => {
    if (!runs.some(isActiveRun)) {
      return;
    }

    const interval = window.setInterval(() => {
      void loadRuns({ silent: true });
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [loadRuns, runs]);

  const sortedRuns = useMemo(
    () =>
      [...runs].sort(
        (left, right) =>
          new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
      ),
    [runs]
  );
  const activeRunCount = runs.filter(isActiveRun).length;
  const failedRunCount = runs.filter((run) => run.status === "FAILED").length;

  async function handleStartSampleRun() {
    setIsCreating(true);
    setError(null);

    try {
      const sampleResponse = await fetch("/samples/risky-plan.json", {
        cache: "no-store"
      });

      if (!sampleResponse.ok) {
        throw new Error("Could not load the bundled sample Terraform plan.");
      }

      await createRun({
        name: "Risky sample plan",
        source: "sample",
        planJson: await sampleResponse.json()
      });
      await loadRuns();
    } catch (unknownError) {
      setError(formatError(unknownError));
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDeleteRun(runId: string) {
    const confirmed = window.confirm("Delete this run?");

    if (!confirmed) {
      return;
    }

    try {
      await deleteRun(runId);
      await loadRuns();
    } catch (unknownError) {
      setError(formatError(unknownError));
    }
  }

  return (
    <main className="workspace">
      <header className="app-header">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">
            IR
          </span>
          <div>
            <p className="eyebrow">Terraform plan review</p>
            <h1>{APP_NAME}</h1>
          </div>
        </div>
        <div className="header-actions">
          <button
            className="button button--secondary"
            disabled={isLoading}
            onClick={() => void loadRuns()}
            type="button"
          >
            {isLoading ? "Refreshing" : "Refresh"}
          </button>
          <button
            className="button button--primary"
            disabled={isCreating}
            onClick={() => void handleStartSampleRun()}
            type="button"
          >
            {isCreating ? "Starting" : "Start sample review"}
          </button>
        </div>
      </header>

      <section className="intro-section" aria-labelledby="intro-heading">
        <div className="intro-copy">
          <p className="section-kicker">Local review workspace</p>
          <h2 id="intro-heading">Find risky infrastructure changes before apply.</h2>
          <p>
            Submit Terraform plan JSON to run deterministic checks for
            destructive changes, public exposure, wildcard IAM permissions,
            missing ownership tags, and overall risk.
          </p>
        </div>
        <div className="api-target" aria-label="Configured API base URL">
          <span>API target</span>
          <code>{API_BASE_URL}</code>
        </div>
      </section>

      <section className="metric-strip" aria-label="Run summary">
        <div className="metric-tile">
          <span>Total runs</span>
          <strong>{runs.length}</strong>
        </div>
        <div className="metric-tile">
          <span>In progress</span>
          <strong>{activeRunCount}</strong>
        </div>
        <div className="metric-tile">
          <span>Failed</span>
          <strong>{failedRunCount}</strong>
        </div>
      </section>

      <section className="runs-section" aria-labelledby="runs-heading">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Review runs</p>
            <h2 id="runs-heading">Recent activity</h2>
          </div>
          <span className="muted-text">
            {activeRunCount > 0 ? "Polling active runs" : "Idle"}
          </span>
        </div>

        {error === null ? null : (
          <ErrorCallout
            action={
              <button
                className="button button--secondary"
                onClick={() => void loadRuns()}
                type="button"
              >
                Retry
              </button>
            }
            message={error}
            title="API request failed"
          />
        )}

        {isLoading && runs.length === 0 ? (
          <div className="loading-row">Loading runs...</div>
        ) : null}

        {!isLoading && error === null && sortedRuns.length === 0 ? (
          <EmptyState
            action={
              <button
                className="button button--primary"
                disabled={isCreating}
                onClick={() => void handleStartSampleRun()}
                type="button"
              >
                {isCreating ? "Starting" : "Start sample review"}
              </button>
            }
            description="Run the bundled Terraform sample to populate findings and risk output."
            title="No review runs yet"
          />
        ) : null}

        {sortedRuns.length > 0 ? (
          <div className="run-list">
            {sortedRuns.map((run) => (
              <article className="run-item" key={run.id}>
                <div className="run-item__header">
                  <div>
                    <h3>{run.name ?? "Untitled review"}</h3>
                    <p>{run.id}</p>
                  </div>
                  <StatusBadge tone={toneForRunStatus(run.status)}>
                    {formatRunStatus(run.status)}
                  </StatusBadge>
                </div>
                <dl className="run-meta">
                  <div>
                    <dt>Step</dt>
                    <dd>{formatWorkflowStep(run.currentStep)}</dd>
                  </div>
                  <div>
                    <dt>Created</dt>
                    <dd>{formatDateTime(run.createdAt)}</dd>
                  </div>
                  <div>
                    <dt>Updated</dt>
                    <dd>{formatDateTime(run.updatedAt)}</dd>
                  </div>
                </dl>
                <div className="run-item__actions">
                  <button
                    className="button button--ghost"
                    onClick={() => void handleDeleteRun(run.id)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}

function isActiveRun(run: Run) {
  return run.status === "QUEUED" || run.status === "RUNNING";
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

function formatError(error: unknown) {
  if (error instanceof ApiClientError) {
    return error.code === undefined
      ? error.message
      : `${error.code}: ${error.message}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "An unknown error occurred.";
}
