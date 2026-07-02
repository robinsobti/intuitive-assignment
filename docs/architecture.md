# Architecture

Infra Change Reviewer is a local web application for reviewing Terraform plan
JSON. It does not run Terraform, apply infrastructure, or call cloud APIs.

## System Design

```text
+------------------+       HTTP JSON        +-------------------+
| Next.js web app  | <--------------------> | Fastify API       |
| localhost:3000   |                        | localhost:4000    |
+------------------+                        +---------+---------+
                                                       |
                                                       | async workflow
                                                       v
                                           +-----------+-----------+
                                           | Analyzer modules      |
                                           | parse, policy, risk   |
                                           +-----------+-----------+
                                                       |
                                                       | local state
                                                       v
                                           +-----------+-----------+
                                           | JSON run store        |
                                           | apps/api/data/runs... |
                                           +-----------------------+
```

Primary packages:

- `apps/web`: Next.js App Router UI.
- `apps/api`: Fastify service, workflow runner, analyzer, JSON storage.
- `packages/shared`: shared Zod schemas and TypeScript types.

## API Layer

The API is built with Fastify in `apps/api/src/app.ts`.

- CORS allows `http://localhost:3000`.
- `GET /health` returns `{ ok: true }`.
- `/runs` routes are registered in `apps/api/src/routes/runs.ts`.
- Request validation for `POST /runs` uses
  `CreateRunRequestSchema` from `@infra-review/shared`.

Run endpoints:

- `POST /runs`: creates a run, persists the input privately, starts the
  asynchronous workflow, returns `202` with `{ run }`.
- `GET /runs`: lists runs without raw input.
- `GET /runs/:runId`: returns one run.
- `GET /runs/:runId/events`: returns workflow events.
- `GET /runs/:runId/result`: returns status plus result when available.
- `DELETE /runs/:runId`: deletes run, events, result, and input.

Errors use a structured envelope:

```json
{
  "error": {
    "code": "RUN_NOT_FOUND",
    "message": "Run '...' was not found.",
    "details": {}
  }
}
```

## State Model

The local store is implemented in `apps/api/src/storage/jsonRunStore.ts`.

It stores one JSON document with:

- `runs`: public run metadata
- `eventsByRunId`: workflow events
- `resultsByRunId`: final report output
- `inputsByRunId`: original request input, including plan JSON

Raw inputs are stored so the asynchronous workflow can process them, but they
are not returned by list/get run endpoints.

The store writes atomically:

1. Clone current state.
2. Write a temporary JSON file.
3. Rename the temporary file over `apps/api/data/runs.json`.

On API startup, any persisted `QUEUED` or `RUNNING` runs are marked `FAILED`.
An event is appended explaining that the local API restarted before the run
completed.

## Workflow

The workflow lives in `apps/api/src/workflow/runner.ts`. `POST /runs` responds
before the workflow completes.

Steps:

1. `RECEIVED_INPUT`
2. `VALIDATING_PLAN`
3. `PARSING_CHANGES`
4. `RUNNING_POLICY_CHECKS`
5. `CALCULATING_RISK`
6. `WRITING_REPORT`
7. `COMPLETED`

Each transition updates the run and appends an event. The UI polls run, events,
and result endpoints while a run is `QUEUED` or `RUNNING`.

## Analyzer

Analyzer modules are deterministic TypeScript functions:

- `terraformPlan.ts`: parses JSON strings or objects, validates
  `resource_changes`, normalizes actions and tags.
- `policies.ts`: checks destructive changes, production destructive changes,
  public admin ingress, public S3 exposure, wildcard IAM policies, and missing
  required tags.
- `risk.ts`: calculates score, severity counts, risk level, and recommendation.

The analyzer supports the subset of Terraform plan JSON needed for this demo.
It does not execute Terraform.

## Failure Handling

Expected failure modes:

- Malformed JSON strings fail with `INVALID_JSON`.
- Inputs without `resource_changes` fail with `INVALID_TERRAFORM_PLAN`.
- Unknown run IDs return a structured `404`.
- Workflow exceptions mark the run `FAILED`, set `currentStep` to `FAILED`, and
  append an error event.
- API restart marks interrupted local runs as failed on startup.

The workflow catches its own errors so individual run failures should not crash
the API process.

## Web Layer

The web app uses Next.js App Router.

- `/`: dashboard with new-run form and previous runs.
- `/runs/[id]`: run detail page with polling, progress stepper, event timeline,
  risk summary, findings table, and resource changes table.

The web API client in `apps/web/src/lib/api.ts` reads
`NEXT_PUBLIC_API_BASE_URL`, defaulting to `http://localhost:4000`.

## Tradeoffs

- JSON storage is easy to inspect and adequate for a local demo, but not a
  production database.
- In-process workflow execution keeps the app small, but does not survive
  restarts.
- Polling is straightforward, but less efficient than WebSockets or
  server-sent events.
- The analyzer is deterministic and testable, but intentionally limited in
  Terraform schema coverage.
- No authentication, authorization, multi-tenant isolation, or deployment
  configuration is included.
