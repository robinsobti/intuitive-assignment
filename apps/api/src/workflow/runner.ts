import { randomUUID } from "node:crypto";
import type {
  Run,
  RunEvent,
  RunResult,
  RunStatus,
  WorkflowStep
} from "@infra-review/shared";
import {
  parsePlanInput,
  summarizeResourceChanges,
  type TerraformChangeSummary,
  type TerraformPlan
} from "../analyzer/terraformPlan.js";
import {
  collectPolicyFindings,
  runPolicyChecks,
  type PolicyFinding,
  type PolicyResult
} from "../analyzer/policies.js";
import {
  calculateRisk,
  type RiskCalculation
} from "../analyzer/risk.js";
import { workflowErrorFromUnknown } from "../lib/errors.js";
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
  plan?: TerraformPlan;
  summary?: TerraformChangeSummary;
  policyResults?: PolicyResult[];
  policyFindings?: PolicyFinding[];
  risk?: RiskCalculation;
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
    run: (context) => {
      context.plan = parsePlanInput(context.input.planJson);
    }
  },
  {
    step: "PARSING_CHANGES",
    status: "RUNNING",
    message: "Parsing resource changes.",
    delayMs: 250,
    run: (context) => {
      context.summary = summarizeResourceChanges(getPlan(context));
    }
  },
  {
    step: "RUNNING_POLICY_CHECKS",
    status: "RUNNING",
    message: "Running policy checks.",
    delayMs: 250,
    run: (context) => {
      context.policyResults = runPolicyChecks(getSummary(context));
    }
  },
  {
    step: "CALCULATING_RISK",
    status: "RUNNING",
    message: "Calculating review risk.",
    delayMs: 250,
    run: (context) => {
      context.policyFindings = collectPolicyFindings(getPolicyResults(context));
      context.risk = calculateRisk(getSummary(context), context.policyFindings);
    }
  },
  {
    step: "WRITING_REPORT",
    status: "RUNNING",
    message: "Writing review report.",
    delayMs: 250,
    run: ({ runId, runStore, summary, policyResults, policyFindings, risk }) => {
      return saveResult(
        runStore,
        runId,
        getDefinedSummary(summary),
        getPolicyResults({ policyResults }),
        getPolicyFindings({ policyFindings }),
        getRisk({ risk })
      );
    }
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
  const failedRun = await runStore.getRun(runId);
  const serializedError = workflowErrorFromUnknown(
    error,
    failedRun?.currentStep
  );
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
    message: `ERROR: ${serializedError.code}: ${serializedError.message}`,
    createdAt: now,
    metadata: { error: serializedError }
  } satisfies RunEvent);
}

function getPlan(context: WorkflowContext) {
  if (context.plan === undefined) {
    throw new Error("Terraform plan was not available.");
  }

  return context.plan;
}

function getSummary(context: WorkflowContext) {
  return getDefinedSummary(context.summary);
}

function getPolicyResults({
  policyResults
}: Pick<WorkflowContext, "policyResults">) {
  if (policyResults === undefined) {
    throw new Error("Policy results were not available.");
  }

  return policyResults;
}

function getPolicyFindings({
  policyFindings
}: Pick<WorkflowContext, "policyFindings">) {
  if (policyFindings === undefined) {
    throw new Error("Policy findings were not available.");
  }

  return policyFindings;
}

function getRisk({ risk }: Pick<WorkflowContext, "risk">) {
  if (risk === undefined) {
    throw new Error("Risk calculation was not available.");
  }

  return risk;
}

function getDefinedSummary(summary: TerraformChangeSummary | undefined) {
  if (summary === undefined) {
    throw new Error("Terraform change summary was not available.");
  }

  return summary;
}

async function saveResult(
  runStore: RunStore,
  runId: string,
  summary: TerraformChangeSummary,
  policyResults: PolicyResult[],
  policyFindings: PolicyFinding[],
  risk: RiskCalculation
) {
  await runStore.saveResult({
    runId,
    recommendation: risk.recommendation,
    riskScore: risk.riskScore,
    riskLevel: risk.riskLevel,
    severityCounts: risk.severityCounts,
    summary: {
      total: summary.total,
      create: summary.create,
      update: summary.update,
      delete: summary.delete,
      replace: summary.replace,
      read: 0,
      noOp: summary.noOp
    },
    changes: summary.changes.map((change) => ({
      address: change.address,
      action: toRunResultAction(change.action),
      type: change.type,
      name: change.name,
      providerName: change.providerName,
      before: change.before,
      after: change.after,
      metadata: {
        terraformActions: change.actions,
        normalizedAction: change.action,
        tags: change.tags
      }
    })),
    findings: policyFindings,
    policyResults,
    generatedAt: nowIso()
  } satisfies RunResult);
}

function toRunResultAction(
  action: TerraformChangeSummary["changes"][number]["action"]
) {
  switch (action) {
    case "create":
      return "CREATE";
    case "update":
      return "UPDATE";
    case "delete":
      return "DELETE";
    case "replace":
      return "REPLACE";
    case "no-op":
    case "unknown":
      return "NO_OP";
  }
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}
