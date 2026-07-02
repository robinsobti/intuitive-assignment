import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { JsonRunStore } from "../src/storage/jsonRunStore.js";
import { startReviewWorkflow } from "../src/workflow/runner.js";

describe("review workflow failures", () => {
  it("marks malformed JSON string inputs as failed with a clear event", async () => {
    const store = await createStore();
    const run = await store.createRun({
      source: "paste",
      planJson: "{not json"
    });

    await startReviewWorkflow({ runId: run.id, runStore: store });

    const failedRun = await store.getRun(run.id);
    const events = await store.getEvents(run.id);
    const failedEvent = events.at(-1);

    expect(failedRun).toMatchObject({
      status: "FAILED",
      currentStep: "FAILED"
    });
    expect(failedEvent).toMatchObject({
      status: "FAILED",
      message: "ERROR: INVALID_JSON: Terraform plan input was not valid JSON."
    });
    expect(failedEvent?.metadata).toMatchObject({
      error: {
        code: "INVALID_JSON",
        message: "Terraform plan input was not valid JSON.",
        step: "VALIDATING_PLAN"
      }
    });
    expect(JSON.stringify(failedEvent?.metadata)).not.toContain("stack");
  });

  it("marks missing resource_changes inputs as failed and exposes result error", async () => {
    const store = await createStore();
    const run = await store.createRun({
      source: "paste",
      planJson: { format_version: "1.2" }
    });

    await startReviewWorkflow({ runId: run.id, runStore: store });

    const app = buildApp({ runStore: store });
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: `/runs/${run.id}/result`
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body).toMatchObject({
      status: "FAILED",
      result: null,
      error: {
        code: "INVALID_TERRAFORM_PLAN",
        message: "Terraform plan must include resource_changes as an array.",
        step: "VALIDATING_PLAN"
      }
    });
    expect(JSON.stringify(body)).not.toContain("stack");

    await app.close();
  });

  it("marks interrupted queued and running runs as failed on startup", async () => {
    const filePath = await createStorePath();
    const store = new JsonRunStore(filePath);
    await store.load();
    const queuedRun = await store.createRun({
      source: "paste",
      planJson: { resource_changes: [] }
    });
    const runningRun = await store.createRun({
      source: "paste",
      planJson: { resource_changes: [] }
    });
    await store.updateRun(runningRun.id, {
      status: "RUNNING",
      currentStep: "PARSING_CHANGES"
    });

    const reloadedStore = new JsonRunStore(filePath);
    await reloadedStore.load();

    expect(await reloadedStore.getRun(queuedRun.id)).toMatchObject({
      status: "FAILED",
      currentStep: "FAILED"
    });
    expect(await reloadedStore.getRun(runningRun.id)).toMatchObject({
      status: "FAILED",
      currentStep: "FAILED"
    });
    await expectRestartEvent(reloadedStore, queuedRun.id);
    await expectRestartEvent(reloadedStore, runningRun.id);
  });

  it("returns structured errors for malformed HTTP JSON", async () => {
    const app = buildApp({ runStore: await createStore() });
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/runs",
      headers: { "content-type": "application/json" },
      payload: "{not json"
    });
    const body = response.json();

    expect(response.statusCode).toBe(400);
    expect(body).toEqual({
      error: {
        code: "BAD_REQUEST",
        message: "Request body could not be parsed or was invalid JSON."
      }
    });
    expect(JSON.stringify(body)).not.toContain("stack");

    await app.close();
  });
});

async function createStore() {
  const store = new JsonRunStore(await createStorePath());
  await store.load();
  return store;
}

async function createStorePath() {
  const directory = await mkdtemp(join(tmpdir(), "infra-review-test-"));
  return join(directory, "runs.json");
}

async function expectRestartEvent(store: JsonRunStore, runId: string) {
  const events = await store.getEvents(runId);

  expect(events.at(-1)).toMatchObject({
    status: "FAILED",
    message: "Local API restarted before the run completed."
  });
}
