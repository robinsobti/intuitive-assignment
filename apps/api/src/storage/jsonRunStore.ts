import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  CreateRunRequest,
  Run,
  RunEvent,
  RunResult
} from "@infra-review/shared";
import { nowIso } from "../lib/time.js";
import type {
  JsonRunStoreState,
  RunStore,
  RunUpdate,
  StoredRunInput
} from "./types.js";

const STORE_VERSION = 1;
const defaultStorePath = fileURLToPath(
  new URL("../../data/runs.json", import.meta.url)
);

function createEmptyState(): JsonRunStoreState {
  return {
    version: STORE_VERSION,
    runs: [],
    eventsByRunId: {},
    resultsByRunId: {},
    inputsByRunId: {}
  };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeState(value: unknown): JsonRunStoreState {
  if (!isRecord(value)) {
    return createEmptyState();
  }

  return {
    version: STORE_VERSION,
    runs: Array.isArray(value.runs) ? (value.runs as Run[]) : [],
    eventsByRunId: isRecord(value.eventsByRunId)
      ? (value.eventsByRunId as Record<string, RunEvent[]>)
      : {},
    resultsByRunId: isRecord(value.resultsByRunId)
      ? (value.resultsByRunId as Record<string, RunResult>)
      : {},
    inputsByRunId: isRecord(value.inputsByRunId)
      ? (value.inputsByRunId as Record<string, StoredRunInput>)
      : {}
  };
}

function isMissingFileError(error: unknown) {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

export class JsonRunStore implements RunStore {
  private state = createEmptyState();
  private loadPromise: Promise<void> | undefined;
  private writeQueue = Promise.resolve();

  constructor(private readonly filePath = defaultStorePath) {}

  async load(): Promise<void> {
    this.loadPromise ??= this.loadFromDisk();
    await this.loadPromise;
  }

  async createRun(input: CreateRunRequest): Promise<Run> {
    await this.ensureLoaded();

    const now = nowIso();
    const run = {
      id: randomUUID(),
      ...(input.name === undefined ? {} : { name: input.name }),
      source: input.source,
      status: "QUEUED",
      currentStep: "RECEIVED_INPUT",
      createdAt: now,
      updatedAt: now
    } satisfies Run;
    const event = {
      id: randomUUID(),
      runId: run.id,
      step: "RECEIVED_INPUT",
      status: "QUEUED",
      message: "Run input received.",
      createdAt: now,
      metadata: { source: input.source }
    } satisfies RunEvent;
    const storedInput = {
      runId: run.id,
      createdAt: now,
      ...(input.name === undefined ? {} : { name: input.name }),
      source: input.source,
      planJson: input.planJson
    } satisfies StoredRunInput;

    this.state.runs.push(run);
    this.state.eventsByRunId[run.id] = [event];
    this.state.inputsByRunId[run.id] = storedInput;
    await this.persist();

    return clone(run);
  }

  async updateRun(runId: string, update: RunUpdate): Promise<Run | null> {
    await this.ensureLoaded();

    const runIndex = this.state.runs.findIndex((run) => run.id === runId);

    if (runIndex === -1) {
      return null;
    }

    const updatedRun = {
      ...this.state.runs[runIndex],
      ...update,
      updatedAt: nowIso()
    } satisfies Run;

    this.state.runs[runIndex] = updatedRun;
    await this.persist();

    return clone(updatedRun);
  }

  async appendEvent(event: RunEvent): Promise<RunEvent> {
    await this.ensureLoaded();

    this.state.eventsByRunId[event.runId] = [
      ...(this.state.eventsByRunId[event.runId] ?? []),
      event
    ];
    await this.persist();

    return clone(event);
  }

  async saveResult(result: RunResult): Promise<RunResult> {
    await this.ensureLoaded();

    this.state.resultsByRunId[result.runId] = result;
    await this.persist();

    return clone(result);
  }

  async getRun(runId: string): Promise<Run | null> {
    await this.ensureLoaded();

    const run = this.state.runs.find((candidate) => candidate.id === runId);

    return run === undefined ? null : clone(run);
  }

  async listRuns(): Promise<Run[]> {
    await this.ensureLoaded();
    return clone(this.state.runs);
  }

  async getEvents(runId: string): Promise<RunEvent[]> {
    await this.ensureLoaded();
    return clone(this.state.eventsByRunId[runId] ?? []);
  }

  async getResult(runId: string): Promise<RunResult | null> {
    await this.ensureLoaded();

    const result = this.state.resultsByRunId[runId];

    return result === undefined ? null : clone(result);
  }

  async deleteRun(runId: string): Promise<boolean> {
    await this.ensureLoaded();

    const initialLength = this.state.runs.length;
    this.state.runs = this.state.runs.filter((run) => run.id !== runId);

    if (this.state.runs.length === initialLength) {
      return false;
    }

    delete this.state.eventsByRunId[runId];
    delete this.state.resultsByRunId[runId];
    delete this.state.inputsByRunId[runId];
    await this.persist();

    return true;
  }

  async saveInput(input: StoredRunInput): Promise<StoredRunInput> {
    await this.ensureLoaded();

    this.state.inputsByRunId[input.runId] = input;
    await this.persist();

    return clone(input);
  }

  async getInput(runId: string): Promise<StoredRunInput | null> {
    await this.ensureLoaded();

    const input = this.state.inputsByRunId[runId];

    return input === undefined ? null : clone(input);
  }

  private async ensureLoaded() {
    await this.load();
  }

  private async loadFromDisk() {
    await mkdir(dirname(this.filePath), { recursive: true });

    try {
      const file = await readFile(this.filePath, "utf8");
      this.state = normalizeState(JSON.parse(file));
    } catch (error) {
      if (!isMissingFileError(error)) {
        throw error;
      }

      this.state = createEmptyState();
      await this.persist();
      return;
    }

    if (this.failInterruptedRuns()) {
      await this.persist();
    }
  }

  private failInterruptedRuns() {
    const now = nowIso();
    let changed = false;

    for (const run of this.state.runs) {
      if (run.status !== "QUEUED" && run.status !== "RUNNING") {
        continue;
      }

      const previousStatus = run.status;
      const previousStep = run.currentStep;

      run.status = "FAILED";
      run.currentStep = "FAILED";
      run.updatedAt = now;
      run.completedAt = now;
      this.state.eventsByRunId[run.id] = [
        ...(this.state.eventsByRunId[run.id] ?? []),
        {
          id: randomUUID(),
          runId: run.id,
          step: "FAILED",
          status: "FAILED",
          message: "Local API restarted before the run completed.",
          createdAt: now,
          metadata: { previousStatus, previousStep }
        }
      ];
      changed = true;
    }

    return changed;
  }

  private async persist() {
    const snapshot = clone(this.state);
    const write = this.writeQueue.then(() => this.writeSnapshot(snapshot));
    this.writeQueue = write.catch(() => undefined);
    await write;
  }

  private async writeSnapshot(snapshot: JsonRunStoreState) {
    await mkdir(dirname(this.filePath), { recursive: true });

    const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
    await rename(tempPath, this.filePath);
  }
}
