import type {
  CreateRunRequest,
  Run,
  RunEvent,
  RunResult
} from "@infra-review/shared";

export type StoredRunInput = CreateRunRequest & {
  runId: string;
  createdAt: string;
};

export type RunUpdate = Partial<
  Pick<Run, "name" | "status" | "currentStep" | "startedAt" | "completedAt">
>;

export type JsonRunStoreState = {
  version: 1;
  runs: Run[];
  eventsByRunId: Record<string, RunEvent[]>;
  resultsByRunId: Record<string, RunResult>;
  inputsByRunId: Record<string, StoredRunInput>;
};

export interface RunStore {
  load(): Promise<void>;
  createRun(input: CreateRunRequest): Promise<Run>;
  updateRun(runId: string, update: RunUpdate): Promise<Run | null>;
  appendEvent(event: RunEvent): Promise<RunEvent>;
  saveResult(result: RunResult): Promise<RunResult>;
  getRun(runId: string): Promise<Run | null>;
  listRuns(): Promise<Run[]>;
  getEvents(runId: string): Promise<RunEvent[]>;
  getResult(runId: string): Promise<RunResult | null>;
  deleteRun(runId: string): Promise<boolean>;
  saveInput(input: StoredRunInput): Promise<StoredRunInput>;
  getInput(runId: string): Promise<StoredRunInput | null>;
}
