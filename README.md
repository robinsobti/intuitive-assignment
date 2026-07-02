# Infra Change Reviewer

Infra Change Reviewer is a local platform-engineering demo for reviewing
Terraform plan JSON before apply. It accepts JSON from `terraform show -json`,
normalizes resource changes, runs deterministic policy checks, calculates a risk
score, and presents findings in a Fastify API plus a Next.js dashboard.

This app does **not** run Terraform, call the Terraform CLI, apply changes,
connect to cloud accounts, or use AI at runtime. It reviews Terraform plan JSON
provided by the user.

## Problem And Use Case

Infrastructure teams often need a quick way to inspect planned changes for
obvious operational and security risks before an apply. This project targets
that workflow:

- Paste or upload a Terraform plan JSON document.
- See workflow progress as the local API validates, parses, checks policy, and
  writes a report.
- Review risk score, recommendation, policy findings, and normalized resource
  changes.
- Use sample inputs to demonstrate risky and invalid plan paths.

The intended scope is a local assessment and demo, not a production policy
platform.

## Demo Flow

1. Start the API and web app:

   ```sh
   pnpm dev
   ```

2. Open `http://localhost:3000`.
3. Click `Load risky sample plan`, or paste/upload Terraform plan JSON.
4. Click `Start Review`.
5. The app redirects to `/runs/{id}`.
6. Watch the workflow stepper and event timeline update.
7. When the run succeeds, review:
   - Risk summary
   - Findings table
   - Resource changes table

### Screenshots

Screenshots are not committed yet. Suggested capture points:

- Dashboard with new-run form and previous runs.
- Run detail page while workflow is running.
- Completed risky sample with risk summary, findings, and resource changes.

## Architecture Overview

```text
Browser / Next.js UI
        |
        | HTTP JSON
        v
Fastify API
        |
        | create run, append events, save results
        v
JSON run store
        |
        v
apps/api/data/runs.json

Analyzer modules run inside the API process:
parse plan -> summarize changes -> run policies -> calculate risk
```

Workspace layout:

- `apps/web`: Next.js App Router dashboard and run detail pages.
- `apps/api`: Fastify API, local JSON store, workflow runner, analyzer logic.
- `packages/shared`: framework-agnostic TypeScript and Zod contracts.
- `samples`: sample Terraform plan JSON files.
- `docs`: architecture and AI interaction documentation.

See [docs/architecture.md](docs/architecture.md) for more detail.

## API Overview

Base URL defaults to `http://localhost:4000`.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Health check, returns `{ "ok": true }`. |
| `POST` | `/runs` | Validate create request, create a run, persist input privately, start workflow asynchronously, return `202`. |
| `GET` | `/runs` | List persisted runs without raw input. |
| `GET` | `/runs/:runId` | Get a single run by ID. |
| `GET` | `/runs/:runId/events` | Get workflow events for a run. |
| `GET` | `/runs/:runId/result` | Get run status plus result when available, or a structured error for failed runs. |
| `DELETE` | `/runs/:runId` | Delete run state, events, result, and stored input. |

Create request shape:

```json
{
  "name": "Optional run name",
  "source": "paste",
  "planJson": "{\"format_version\":\"1.2\",\"resource_changes\":[]}"
}
```

`source` must be `paste`, `upload`, or `sample`. The web UI submits the raw
textarea string as `planJson`; the API accepts either a JSON string or object.

Unknown run IDs return a structured error envelope:

```json
{
  "error": {
    "code": "RUN_NOT_FOUND",
    "message": "Run '...' was not found.",
    "details": {
      "runId": "..."
    }
  }
}
```

## Workflow

The API creates a run in `QUEUED` state, then starts an asynchronous local
workflow:

1. `RECEIVED_INPUT`
2. `VALIDATING_PLAN`
3. `PARSING_CHANGES`
4. `RUNNING_POLICY_CHECKS`
5. `CALCULATING_RISK`
6. `WRITING_REPORT`
7. `COMPLETED`

If a step throws, the run is marked `FAILED`, `currentStep` is set to `FAILED`,
and a clear error event is appended. Failed result responses include a
structured error such as `INVALID_JSON` or `INVALID_TERRAFORM_PLAN` when the
input cannot be parsed as a Terraform plan. The API process should not crash on
workflow errors, and API error responses do not include raw stack traces.

## Analyzer And Risk Model

The analyzer does not call Terraform. It expects Terraform plan JSON with a
`resource_changes` array and normalizes a subset of fields:

- Address, type, name, provider name
- Change actions
- Before/after values
- Tags from `tags` and `tags_all`
- Normalized owner, service, and environment tags

Implemented deterministic policy checks:

- Destructive delete or replace
- Production-tagged delete or replace
- Public administrative ingress on security groups
- Public S3 ACLs, public access block flags, and public bucket policies
- Wildcard IAM policy actions/resources
- Missing required owner, service, or environment tags

Risk scoring is deterministic and capped at 100. The recommendation is one of:

- `APPROVE`
- `REVIEW`
- `BLOCK`

## State Management

This is a local demo with no database. State is stored in:

```text
apps/api/data/runs.json
```

The file is ignored by git. `apps/api/data/.gitkeep` is kept so the directory
can exist in a fresh checkout.

The JSON store keeps:

- Runs
- Events by run ID
- Results by run ID
- Original run inputs by run ID

Raw inputs are persisted locally so the workflow can process them, but list/get
run APIs do not expose raw inputs.

Writes are atomic: the store writes a temporary file and then renames it over
`runs.json`. On startup, existing `QUEUED` or `RUNNING` runs are marked
`FAILED` with an event explaining that the local API restarted before
completion.

## Local Setup

Prerequisites:

- Node.js 20 or newer
- pnpm 10.12.1, or Corepack enabled

Install dependencies:

```sh
corepack enable
pnpm install
```

If `pnpm` is not on your PATH, either install pnpm or run it through npm:

```sh
npm exec --yes --package pnpm@10.12.1 -- pnpm install
```

## Running The App

Run API and web together:

```sh
pnpm dev
```

Default local URLs:

- Web: `http://localhost:3000`
- API: `http://localhost:4000`

The web app reads `NEXT_PUBLIC_API_BASE_URL`, defaulting to
`http://localhost:4000`.

Run packages individually:

```sh
pnpm --filter @infra-review/api dev
pnpm --filter @infra-review/web dev
```

## Running Tests And Checks

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm check
```

Focused commands:

```sh
pnpm --filter @infra-review/api test
pnpm --filter @infra-review/api typecheck
pnpm --filter @infra-review/web typecheck
pnpm --filter @infra-review/shared typecheck
```

## Sample Input

Committed samples:

- `samples/risky-plan.json`: compact Terraform plan JSON that produces
  destructive, public exposure, wildcard IAM, and missing-tag findings.
- `apps/web/public/samples/risky-plan.json`: same risky sample served to the web
  UI.
- `samples/invalid-plan.json`: valid JSON, but intentionally missing
  `resource_changes` for failure-path testing.

Example API call:

```sh
curl -s -X POST http://localhost:4000/runs \
  -H "Content-Type: application/json" \
  -d '{"name":"test","source":"paste","planJson":{"resource_changes":[]}}'
```

## Design Decisions

- Shared Zod schemas and inferred TypeScript types live in
  `packages/shared` so API and web use the same contracts.
- The API uses Fastify with CORS restricted to `http://localhost:3000`.
- The workflow writes event records as it advances so the UI can poll and show
  progress without fake percentages.
- The web app uses plain CSS and local components instead of a UI framework.
- Persistence is file-backed JSON for assessment simplicity.
- Policy checks are deterministic TypeScript functions. No AI model is called
  by the running app.

## Tradeoffs

- File-backed JSON is simple and inspectable, but it is not designed for
  concurrent multi-process writes or production durability.
- The workflow runs in-process. A server restart interrupts active runs.
- Terraform parsing supports the fields needed for this demo, not the complete
  Terraform plan schema.
- Policy checks are intentionally narrow and deterministic; they are not a
  replacement for a mature policy-as-code or cloud security platform.
- The UI polls instead of using WebSockets or server-sent events.
- Authentication, authorization, rate limiting, and multi-user isolation are not
  implemented.

## Next Steps

- Add a durable database and migration-backed schema.
- Move workflow execution to a queue/worker process.
- Add user authentication and workspace scoping.
- Expand Terraform plan parsing coverage.
- Add more policy checks and configurable policy severity.
- Add downloadable reports.
- Add end-to-end browser tests for dashboard and detail flows.
- Add screenshots or a short demo recording.

## AI Usage Disclosure

This repository was developed with AI assistance through Codex. AI was used to
help plan, implement, document, and validate the local demo. The application
itself does not call AI models at runtime.

See [docs/ai-interaction-log.md](docs/ai-interaction-log.md) for the AI
interaction log and template.
