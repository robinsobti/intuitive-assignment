# AI Interaction Log

This file records meaningful AI-assisted planning and implementation work for
the project. It is a summary log, not a full transcript.

Supporting transcript excerpt: [docs/ai-logs/codex-session.md](ai-logs/codex-session.md).

## Template

```md
## YYYY-MM-DD - Short title

- Context: What the human asked for or what project phase was underway.
- AI assistance: What Codex helped plan, implement, debug, or document.
- Human decisions: Any explicit constraints, requested changes, or approvals.
- Validation: Checks, tests, or manual verification performed.
- Notes: Known limitations or follow-up items.
```

## 2026-07-02 - End-to-end local Terraform plan review demo

- Context: The project was built through a sequence of implementation phases:
  shared domain contracts, Fastify API skeleton, JSON-backed local persistence,
  asynchronous workflow orchestration, Terraform plan parsing, deterministic
  policy checks, risk scoring, sample inputs, Next.js dashboard, run creation,
  run detail polling, event timeline, final result tables, and assessment
  documentation.
- AI assistance: Codex helped inspect the repository, write TypeScript and Zod
  code, add Fastify routes, implement the local JSON store, build analyzer
  modules, create sample Terraform plan JSON, implement the Next.js UI, add
  README and architecture documentation, and run validation commands from the
  local workspace.
- Human decisions: The human supplied the phase goals, constraints, file lists,
  acceptance criteria, validation commands, and commit messages. Important
  constraints included using Terraform plan JSON only, not running Terraform,
  using deterministic policy checks rather than runtime AI, keeping persistence
  local, and documenting AI usage.
- Validation: The implementation phases were checked with focused package
  commands such as API tests, package typechecks, `pnpm dev`, local API calls,
  and page fetches. For this documentation phase, the intended validation is
  `pnpm check`.
- Notes: The app is a local assessment demo. It has no production database,
  authentication, authorization, background worker queue, or complete Terraform
  plan schema coverage.

## Phase Entries

### 2026-07-01 17:02:51 -0700 - Repo scaffold

- Tool used: Codex.
- What I asked AI to do: Scaffold the initial TypeScript monorepo.
- Prompt summary: Create the base workspace structure for API, web, shared
  package, sample files, and documentation.
- What AI suggested/changed: Created the initial monorepo layout and package
  scripts.
- What I accepted: The scaffolded workspace and initial commit.
- What I rejected or modified: No rejected changes recorded in the local log.
- Validation commands run: Phase-specific validation is not preserved in the
  transcript; later full validation used `pnpm check`.
- Result: Initial project structure committed.
- Commit message: `chore: scaffold TypeScript monorepo`.

### 2026-07-01 17:23:29 -0700 - Shared domain model

- Tool used: Codex.
- What I asked AI to do: Define shared run, event, finding, policy, result, and
  API request/response contracts.
- Prompt summary: Add framework-agnostic TypeScript and Zod schemas in
  `packages/shared`, including exact statuses, workflow steps, severities, and
  recommendations.
- What AI suggested/changed: Added Zod schemas, inferred TypeScript types, and
  shared exports.
- What I accepted: Shared schemas and type exports.
- What I rejected or modified: Analyzer logic was intentionally left out.
- Validation commands run: `pnpm --filter @infra-review/shared typecheck`.
- Result: Shared package typecheck passed before commit.
- Commit message: `feat(shared): define review run domain model`.

### 2026-07-01 17:39:39 -0700 - API skeleton

- Tool used: Codex.
- What I asked AI to do: Add Fastify route structure and placeholder run
  endpoints.
- Prompt summary: Register `/health` and `/runs`, enable CORS for
  `http://localhost:3000`, and return useful placeholder data without
  persistence or analyzer behavior.
- What AI suggested/changed: Added Fastify app/server setup and run routes.
- What I accepted: API service skeleton.
- What I rejected or modified: Persistence and analyzer implementation were
  deferred.
- Validation commands run: `pnpm --filter @infra-review/api typecheck`,
  `pnpm --filter @infra-review/api dev`, and `curl` smoke checks.
- Result: API skeleton committed and pushed.
- Commit message: `feat(api): add Fastify service skeleton`.

### 2026-07-01 18:30:26 -0700 - Local JSON persistence

- Tool used: Codex.
- What I asked AI to do: Implement a JSON-backed run store for local demo state.
- Prompt summary: Store runs, events, results, and private inputs in
  `apps/api/data/runs.json` with atomic writes and startup recovery for
  interrupted runs.
- What AI suggested/changed: Added storage interfaces, JSON store, time/error
  helpers, route integration, and gitignore coverage.
- What I accepted: Local file-backed persistence.
- What I rejected or modified: No database or production persistence layer was
  added.
- Validation commands run: `pnpm --filter @infra-review/api typecheck` and
  `pnpm --filter @infra-review/api test`.
- Result: API persistence committed and pushed.
- Commit message: `feat(api): persist review state locally`.

### 2026-07-01 18:45:19 -0700 - Workflow runner

- Tool used: Codex.
- What I asked AI to do: Start an asynchronous review workflow after
  `POST /runs`.
- Prompt summary: Validate create requests with shared schemas, persist input,
  return `202`, advance through workflow steps, record events, and fail safely
  without crashing the API.
- What AI suggested/changed: Added workflow orchestration and wired run
  creation to start the runner.
- What I accepted: In-process asynchronous workflow.
- What I rejected or modified: Analyzer logic remained placeholder at this
  phase.
- Validation commands run: `pnpm --filter @infra-review/api typecheck`,
  `pnpm --filter @infra-review/api dev`, and a `curl` create-run smoke test.
- Result: Workflow endpoints committed and pushed.
- Commit message: `feat(api): orchestrate review run workflow`.

### 2026-07-01 18:58:34 -0700 - Terraform plan parsing

- Tool used: Codex.
- What I asked AI to do: Parse Terraform plan JSON and normalize resource
  changes.
- Prompt summary: Accept JSON strings or objects, reject malformed JSON and
  missing `resource_changes`, normalize actions, and extract common tags.
- What AI suggested/changed: Added plan parser, summary logic, tests, and
  workflow integration.
- What I accepted: Deterministic parser and normalized change summary.
- What I rejected or modified: Terraform CLI execution was not added.
- Validation commands run: `pnpm --filter @infra-review/api test`.
- Result: Analyzer parsing committed and pushed.
- Commit message: `feat(analyzer): parse Terraform plan changes`.

### 2026-07-01 19:11:58 -0700 - Platform policy checks

- Tool used: Codex.
- What I asked AI to do: Add concrete deterministic policy checks.
- Prompt summary: Check destructive changes, production destructive changes,
  public admin ingress, public S3 access, wildcard IAM policy, and missing
  required tags.
- What AI suggested/changed: Added policy checks, finding generation, sorting,
  and unit tests.
- What I accepted: Deterministic TypeScript policy checks.
- What I rejected or modified: Runtime AI policy evaluation was not added.
- Validation commands run: `pnpm --filter @infra-review/api test`.
- Result: Policy checks committed and pushed.
- Commit message: `feat(analyzer): add platform policy checks`.

### 2026-07-01 19:27:06 -0700 - Sample Terraform plans

- Tool used: Codex.
- What I asked AI to do: Add risky and invalid Terraform plan samples.
- Prompt summary: Create compact JSON samples that demonstrate production
  replacement/deletion, public ingress, public S3 access, wildcard IAM, and
  missing tags.
- What AI suggested/changed: Added root samples and copied the risky sample to
  the web public directory.
- What I accepted: Representative sample inputs.
- What I rejected or modified: Oversized sample data was avoided.
- Validation commands run: JSON parse check and
  `pnpm --filter @infra-review/api test`.
- Result: Sample files committed and pushed.
- Commit message: `test: add representative Terraform plan samples`.

### 2026-07-02 11:33:45 -0700 - Risk calculation

- Tool used: Codex.
- What I asked AI to do: Add deterministic risk scoring and recommendation
  logic.
- Prompt summary: Score actions and findings, cap risk at 100, derive risk
  level, severity counts, and `APPROVE`/`REVIEW`/`BLOCK`.
- What AI suggested/changed: Added risk module, tests, and workflow result
  integration.
- What I accepted: Deterministic scoring model.
- What I rejected or modified: No probabilistic or AI-based scoring was added.
- Validation commands run: `pnpm --filter @infra-review/api test`.
- Result: Risk calculation committed and pushed.
- Commit message: `feat(analyzer): calculate infrastructure change risk`.

### 2026-07-02 11:34:02 -0700 - Frontend foundation

- Tool used: Codex.
- What I asked AI to do: Build the initial Next.js frontend structure and API
  client.
- Prompt summary: Add API client helpers, formatting helpers, base components,
  layout, global CSS, and an intentional home page.
- What AI suggested/changed: Added frontend foundation without a UI component
  library.
- What I accepted: Plain CSS and local component approach.
- What I rejected or modified: No architecture change or UI library was added.
- Validation commands run: `pnpm --filter @infra-review/web typecheck`.
- Result: Frontend foundation committed and pushed.
- Commit message: `feat(web): add frontend foundation and API client`.

### 2026-07-02 11:51:36 -0700 - Dashboard run creation

- Tool used: Codex.
- What I asked AI to do: Implement dashboard run creation.
- Prompt summary: Add name input, textarea, file upload, risky sample loading,
  submit behavior, redirect, and previous run list.
- What AI suggested/changed: Added `NewRunForm`, `RunList`, dashboard wiring,
  and related CSS.
- What I accepted: Client-side paste/upload/sample workflow.
- What I rejected or modified: No new UI library or backend feature was added.
- Validation commands run: `pnpm --filter @infra-review/web typecheck` and
  `pnpm dev`.
- Result: Dashboard run creation committed and pushed.
- Commit message: `feat(web): create Terraform review runs from UI`.

### 2026-07-02 12:00:24 -0700 - Run detail progress

- Tool used: Codex.
- What I asked AI to do: Implement the run detail page with polling, progress,
  and events.
- Prompt summary: Poll run/events/result every second while active, show loading
  and error states, render all workflow steps, and display event timeline.
- What AI suggested/changed: Added `/runs/[id]`, `ProgressStepper`,
  `EventTimeline`, and CSS updates.
- What I accepted: Polling-based run detail view.
- What I rejected or modified: Fake percentages were avoided.
- Validation commands run: `pnpm --filter @infra-review/web typecheck` and
  `pnpm dev`.
- Result: Progress UI committed and pushed.
- Commit message: `feat(web): show review workflow progress`.

### 2026-07-02 12:29:12 -0700 - Result and finding views

- Tool used: Codex.
- What I asked AI to do: Add final result views once the workflow succeeds.
- Prompt summary: Show risk summary, findings table, and resource changes table
  with severity/action highlighting and small-screen readability.
- What AI suggested/changed: Added result components, formatting helpers, page
  integration, and responsive CSS.
- What I accepted: Final result presentation.
- What I rejected or modified: No fake data was added.
- Validation commands run: `pnpm --filter @infra-review/web typecheck` and
  `pnpm dev`; a risky sample run returned `BLOCK`, risk `100`, 9 findings, and
  7 changes.
- Result: Result UI committed and pushed.
- Commit message: `feat(web): present risk findings and resource changes`.

### 2026-07-02 12:38:26 -0700 - README and architecture docs

- Tool used: Codex.
- What I asked AI to do: Write comprehensive assessment documentation.
- Prompt summary: Document setup, demo flow, API, state management,
  architecture, tradeoffs, next steps, and AI usage without exaggerating
  capabilities.
- What AI suggested/changed: Updated `README.md`, added
  `docs/architecture.md`, and created this AI interaction log.
- What I accepted: Assessment documentation and architecture overview.
- What I rejected or modified: Claims that the app runs Terraform or provides
  production security coverage were avoided.
- Validation commands run: `pnpm check`.
- Result: Documentation committed and pushed.
- Commit message: `docs: document setup architecture and AI usage`.

### 2026-07-02 13:28:44 -0700 - Error handling polish

- Tool used: Codex.
- What I asked AI to do: Harden reliability and operator-facing error handling
  before submission.
- Prompt summary: Ensure invalid JSON and missing `resource_changes` fail
  clearly, interrupted runs are handled, unavailable API messages are useful,
  buttons show loading states, and stack traces are not returned.
- What AI suggested/changed: Added structured Fastify errors, sanitized
  workflow errors, failed-run result errors, regression tests, and small UI
  loading/error improvements.
- What I accepted: Narrow hardening changes and tests.
- What I rejected or modified: No broad rewrite or architecture change was
  made.
- Validation commands run: `pnpm typecheck`, `pnpm test`, and `pnpm build`.
- Result: Hardening committed and pushed.
- Commit message: `fix: harden review workflow error handling`.

### 2026-07-02 14:18 - Final validation review

- Tool used: Codex.
- What I asked AI to do: Act as a strict reviewer and find inconsistencies,
  missing files, broken scripts, and README mismatches.
- Prompt summary: Check package scripts, imports, type errors, test reliability,
  README command accuracy, and sample-file paths without adding features.
- What AI suggested/changed: No code changes were made because no
  submission-blocking inconsistency was found.
- What I accepted: Validation findings.
- What I rejected or modified: Empty final validation commit was not created.
- Validation commands run: `pnpm typecheck`, `pnpm test`, `pnpm build`,
  `pnpm check`, `env CI=true pnpm install --frozen-lockfile`, `pnpm dev`,
  `curl http://localhost:4000/health`, `curl http://localhost:4000/runs`, web
  root `curl -I`, sample JSON parse checks, and sample file comparison.
- Result: Validation passed; git status was clean except ignored local
  artifacts.
- Commit message: None; no tracked changes were produced by this review.
