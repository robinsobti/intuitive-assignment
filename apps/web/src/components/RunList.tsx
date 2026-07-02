"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Run, RunStatus } from "@infra-review/shared";
import { deleteRun, getApiErrorMessage, listRuns } from "../lib/api";
import {
  formatDateTime,
  formatRunStatus,
  formatWorkflowStep
} from "../lib/formatting";
import { EmptyState } from "./EmptyState";
import { ErrorCallout } from "./ErrorCallout";
import { StatusBadge, type StatusBadgeTone } from "./StatusBadge";

const pollIntervalMs = 2500;

export function RunList() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingRunId, setDeletingRunId] = useState<string | null>(null);

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
        setError(getApiErrorMessage(unknownError));
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
    }, pollIntervalMs);

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

  async function handleDeleteRun(runId: string) {
    const confirmed = window.confirm("Delete this run?");

    if (!confirmed) {
      return;
    }

    setDeletingRunId(runId);
    setError(null);

    try {
      await deleteRun(runId);
      await loadRuns();
    } catch (unknownError) {
      setError(getApiErrorMessage(unknownError));
    } finally {
      setDeletingRunId(null);
    }
  }

  return (
    <section className="runs-section panel" aria-labelledby="runs-heading">
      <div className="panel-heading">
        <div>
          <p className="section-kicker">Review runs</p>
          <h2 id="runs-heading">Previous runs</h2>
        </div>
        <div className="panel-heading__actions">
          <span className="muted-text">
            {activeRunCount > 0 ? "Polling active runs" : "Ready"}
          </span>
          <button
            className="button button--secondary"
            disabled={isLoading}
            onClick={() => void loadRuns()}
            type="button"
          >
            {isLoading ? "Refreshing" : "Refresh"}
          </button>
        </div>
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
          title="Could not load runs"
        />
      )}

      {isLoading && runs.length === 0 ? (
        <div className="loading-row">Loading runs...</div>
      ) : null}

      {!isLoading && error === null && sortedRuns.length === 0 ? (
        <EmptyState
          description="Load the risky sample plan above or paste your own Terraform plan JSON to create the first review."
          title="No review runs yet"
        />
      ) : null}

      {sortedRuns.length > 0 ? (
        <div className="run-list">
          {sortedRuns.map((run) => (
            <article className="run-item" key={run.id}>
              <div className="run-item__header">
                <div>
                  <h3>
                    <Link href={`/runs/${run.id}`}>
                      {run.name ?? "Untitled review"}
                    </Link>
                  </h3>
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
                <Link className="button button--secondary" href={`/runs/${run.id}`}>
                  Open run
                </Link>
                <button
                  className="button button--ghost"
                  disabled={deletingRunId === run.id}
                  onClick={() => void handleDeleteRun(run.id)}
                  type="button"
                >
                  {deletingRunId === run.id ? "Deleting" : "Delete"}
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
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
