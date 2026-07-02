import { randomUUID } from "node:crypto";
import type {
  Run,
  RunEvent,
  RunResult,
  RunStatus,
  WorkflowStep
} from "@infra-review/shared";
import { nowIso } from "../lib/time.js";
import type { RunStore, StoredRunInput } from "../storage/types.js";

type WorkflowLogger = {
  error: (payload: unknown, message?: string) => void;
};

type WorkflowStepDefinition = {
  step: WorkflowStep;
  status: RunStatus;
  message: string;
  delayMs: number;
  run?: (context: WorkflowContext) => Promise<void> | void;
};

type WorkflowContext = {
  runId: string;
  runStore: RunStore;
  input: StoredRunInput;
};

export type StartReviewWorkflowOptions = {
  runId: string;
  runStore: RunStore;
  logger?: WorkflowLogger;
};

export type StartReviewWorkflow = (
  options: StartReviewWorkflowOptions
) => Promise<void>;

const workflowSteps: WorkflowStepDefinition[] = [
  {
    step: "RECEIVED_INPUT",
    status: "RUNNING",
    message: "Review workflow started.",
    delayMs: 250
  },
  {
    step: "VALIDATING_PLAN",
    status: "RUNNING",
    message: "Validating Terraform plan input.",
    delayMs: 250,
    run: ({ input }) => validatePlanJson(input.planJson)
  },
  {
    step: "PARSING_CHANGES",
    status: "RUNNING",
    message: "Parsing resource changes.",
    delayMs: 250
  },
  {
    step: "RUNNING_POLICY_CHECKS",
    status: "RUNNING",
    message: "Running policy checks.",
    delayMs: 250
  },
  {
    step: "CALCULATING_RISK",
    status: "RUNNING",
    message: "Calculating review risk.",
    delayMs: 250
  },
  {
    step: "WRITING_REPORT",
    status: "RUNNING",
    message: "Writing placeholder review report.",
    delayMs: 250,
    run: ({ runId, runStore }) => savePlaceholderResult(runStore, runId)
  },
  {
    step: "COMPLETED",
    status: "SUCCEEDED",
    message: "Review workflow completed.",
    delayMs: 0
  }
];

export const startReviewWorkflow: StartReviewWorkflow = async ({
  runId,
  runStore,
  logger
}) => {
  try {
    await runWorkflow({ runId, runStore });
  } catch (error) {
    logger?.error({ error, runId }, "Review workflow failed");

    try {
      await failRun(runStore, runId, error);
    } catch (failureError) {
      logger?.error(
        { error: failureError, runId },
        "Failed to persist workflow failure"
      );
    }
  }
};

async function runWorkflow(options: Omit<WorkflowContext, "input">) {
  const input = await options.runStore.getInput(options.runId);

  if (input === null) {
    throw new Error(`Run input '${options.runId}' was not found.`);
  }

  const context = { ...options, input };

  for (const step of workflowSteps) {
    await transitionRun(context.runStore, context.runId, step);
    await step.run?.(context);

    if (step.delayMs > 0) {
      await sleep(step.delayMs);
    }
  }
}

async function transitionRun(
  runStore: RunStore,
  runId: string,
  step: WorkflowStepDefinition
) {
  const now = nowIso();
  const update = {
    status: step.status,
    currentStep: step.step,
    ...(step.step === "RECEIVED_INPUT" ? { startedAt: now } : {}),
    ...(step.step === "COMPLETED" ? { completedAt: now } : {})
  } satisfies Parameters<RunStore["updateRun"]>[1];
  const run = await runStore.updateRun(runId, update);

  if (run === null) {
    throw new Error(`Run '${runId}' was not found.`);
  }

  await runStore.appendEvent({
    id: randomUUID(),
    runId,
    step: step.step,
    status: step.status,
    message: step.message,
    createdAt: now
  } satisfies RunEvent);
}

async function failRun(runStore: RunStore, runId: string, error: unknown) {
  const now = nowIso();
  const serializedError = serializeError(error);
  await runStore.updateRun(runId, {
    status: "FAILED",
    currentStep: "FAILED",
    completedAt: now
  });
  await runStore.appendEvent({
    id: randomUUID(),
    runId,
    step: "FAILED",
    status: "FAILED",
    message: "ERROR: Review workflow failed.",
    createdAt: now,
    metadata: { error: serializedError }
  } satisfies RunEvent);
}

function validatePlanJson(planJson: unknown) {
  if (typeof planJson !== "object" || planJson === null || Array.isArray(planJson)) {
    throw new Error("Terraform plan JSON must be an object.");
  }
}

async function savePlaceholderResult(runStore: RunStore, runId: string) {
  await runStore.saveResult({
    runId,
    recommendation: "REVIEW",
    summary: {
      total: 0,
      create: 0,
      update: 0,
      delete: 0,
      replace: 0,
      read: 0,
      noOp: 0
    },
    changes: [],
    findings: [],
    policyResults: [],
    generatedAt: nowIso()
  } satisfies RunResult);
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message
    };
  }

  return { message: String(error) };
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}
