import type { RunEvent, RunStatus, WorkflowStep } from "@infra-review/shared";
import { formatWorkflowStep } from "../lib/formatting";

type ProgressStepperProps = {
  currentStep: WorkflowStep;
  events: RunEvent[];
  status: RunStatus;
};

const workflowSteps: WorkflowStep[] = [
  "RECEIVED_INPUT",
  "VALIDATING_PLAN",
  "PARSING_CHANGES",
  "RUNNING_POLICY_CHECKS",
  "CALCULATING_RISK",
  "WRITING_REPORT",
  "COMPLETED",
  "FAILED"
];

export function ProgressStepper({
  currentStep,
  events,
  status
}: ProgressStepperProps) {
  const eventSteps = new Set(events.map((event) => event.step));
  const currentStepIndex = workflowSteps.indexOf(currentStep);

  return (
    <ol className="progress-stepper" aria-label="Workflow progress">
      {workflowSteps.map((step, index) => {
        const state = getStepState({
          currentStep,
          currentStepIndex,
          eventSteps,
          index,
          status,
          step
        });

        return (
          <li className={`progress-step progress-step--${state}`} key={step}>
            <span className="progress-step__marker" aria-hidden="true" />
            <div>
              <span className="progress-step__label">
                {formatWorkflowStep(step)}
              </span>
              <span className="progress-step__state">{formatStepState(state)}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function getStepState({
  currentStep,
  currentStepIndex,
  eventSteps,
  index,
  status,
  step
}: {
  currentStep: WorkflowStep;
  currentStepIndex: number;
  eventSteps: Set<WorkflowStep>;
  index: number;
  status: RunStatus;
  step: WorkflowStep;
}) {
  if (step === "FAILED" && status === "FAILED") {
    return "failed";
  }

  if (step === currentStep && status !== "SUCCEEDED") {
    return "current";
  }

  if (status === "SUCCEEDED" && step !== "FAILED") {
    return "complete";
  }

  if (eventSteps.has(step)) {
    return "complete";
  }

  if (currentStep !== "FAILED" && currentStepIndex > index) {
    return "complete";
  }

  return "pending";
}

function formatStepState(state: ReturnType<typeof getStepState>) {
  switch (state) {
    case "complete":
      return "Complete";
    case "current":
      return "Current";
    case "failed":
      return "Failed";
    case "pending":
      return "Pending";
  }
}
