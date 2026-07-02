"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { CreateRunSource } from "@infra-review/shared";
import { createRun, getApiErrorMessage } from "../lib/api";
import { ErrorCallout } from "./ErrorCallout";

const samplePath = "/samples/risky-plan.json";

export function NewRunForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [planJson, setPlanJson] = useState("");
  const [source, setSource] = useState<CreateRunSource>("paste");
  const [fileName, setFileName] = useState<string | null>(null);
  const [isLoadingSample, setIsLoadingSample] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLoadSample() {
    if (isSubmitting) {
      return;
    }

    setIsLoadingSample(true);
    setError(null);

    try {
      const response = await fetch(samplePath, { cache: "no-store" });

      if (!response.ok) {
        throw new Error("Could not load the bundled risky sample plan.");
      }

      setPlanJson(await response.text());
      setSource("sample");
      setFileName(null);
    } catch (unknownError) {
      setError(getApiErrorMessage(unknownError));
    } finally {
      setIsLoadingSample(false);
    }
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    if (isSubmitting || isLoadingSample) {
      event.target.value = "";
      return;
    }

    const file = event.target.files?.[0];

    if (file === undefined) {
      return;
    }

    setError(null);

    try {
      setPlanJson(await file.text());
      setSource("upload");
      setFileName(file.name);
    } catch (unknownError) {
      setError(getApiErrorMessage(unknownError));
    } finally {
      event.target.value = "";
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (planJson.trim() === "") {
      setError("Paste, upload, or load Terraform plan JSON before starting.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await createRun({
        name: name.trim() === "" ? undefined : name.trim(),
        source,
        planJson
      });

      router.push(`/runs/${response.run.id}`);
    } catch (unknownError) {
      setError(getApiErrorMessage(unknownError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="new-run-form panel" onSubmit={handleSubmit}>
      <div className="panel-heading">
        <div>
          <p className="section-kicker">New review</p>
          <h2>Start with a Terraform plan</h2>
        </div>
      </div>

      {error === null ? null : (
        <ErrorCallout message={error} title="Could not start review" />
      )}

      <label className="field">
        <span>Run name</span>
        <input
          autoComplete="off"
          name="name"
          onChange={(event) => setName(event.target.value)}
          placeholder="Production network change"
          type="text"
          value={name}
        />
      </label>

      <label className="field">
        <span>Terraform plan JSON</span>
        <textarea
          name="planJson"
          onChange={(event) => {
            setPlanJson(event.target.value);
            setSource("paste");
            setFileName(null);
          }}
          placeholder='{"format_version":"1.2","resource_changes":[]}'
          spellCheck={false}
          value={planJson}
        />
      </label>

      <div className="form-actions">
        <input
          ref={fileInputRef}
          accept=".json,application/json"
          className="visually-hidden"
          disabled={isSubmitting || isLoadingSample}
          onChange={(event) => void handleFileChange(event)}
          type="file"
        />
        <button
          className="button button--secondary"
          disabled={isSubmitting || isLoadingSample}
          onClick={() => fileInputRef.current?.click()}
          type="button"
        >
          Upload JSON
        </button>
        <button
          className="button button--secondary"
          disabled={isSubmitting || isLoadingSample}
          onClick={() => void handleLoadSample()}
          type="button"
        >
          {isLoadingSample ? "Loading sample" : "Load risky sample plan"}
        </button>
        <button
          className="button button--primary form-actions__submit"
          disabled={isSubmitting || isLoadingSample}
          type="submit"
        >
          {isSubmitting ? "Starting review" : "Start Review"}
        </button>
      </div>

      <p className="form-hint">
        {fileName === null
          ? "Plan JSON is sent as text so the API can validate and parse it."
          : `Loaded ${fileName}.`}
      </p>
    </form>
  );
}
