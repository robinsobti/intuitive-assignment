import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  collectPolicyFindings,
  runPolicyChecks
} from "../src/analyzer/policies.js";
import { calculateRisk } from "../src/analyzer/risk.js";
import {
  parsePlanInput,
  summarizeResourceChanges
} from "../src/analyzer/terraformPlan.js";

describe("risk calculation", () => {
  it("approves empty change plans", () => {
    const summary = summarizeResourceChanges(
      parsePlanInput({ resource_changes: [] })
    );

    expect(calculateRisk(summary, [])).toEqual({
      riskScore: 0,
      riskLevel: "LOW",
      severityCounts: {
        LOW: 0,
        MEDIUM: 0,
        HIGH: 0,
        CRITICAL: 0
      },
      recommendation: "APPROVE"
    });
  });

  it("reviews non-critical plans above the approval threshold", () => {
    const summary = summarizeResourceChanges(
      parsePlanInput({
        resource_changes: [
          resourceChange("aws_instance.web", "aws_instance", ["update"])
        ]
      })
    );

    expect(calculateRisk(summary, [{ severity: "HIGH" }])).toEqual({
      riskScore: 27,
      riskLevel: "MEDIUM",
      severityCounts: {
        LOW: 0,
        MEDIUM: 0,
        HIGH: 1,
        CRITICAL: 0
      },
      recommendation: "REVIEW"
    });
  });

  it("blocks and caps representative risky plans", () => {
    const samplePlan = JSON.parse(
      readFileSync(
        new URL("../../../samples/risky-plan.json", import.meta.url),
        "utf8"
      )
    );
    const summary = summarizeResourceChanges(parsePlanInput(samplePlan));
    const findings = collectPolicyFindings(runPolicyChecks(summary));
    const risk = calculateRisk(summary, findings);

    expect(risk).toEqual(
      expect.objectContaining({
        riskScore: 100,
        riskLevel: "CRITICAL",
        recommendation: "BLOCK",
        severityCounts: expect.objectContaining({
          CRITICAL: expect.any(Number),
          HIGH: expect.any(Number)
        })
      })
    );
    expect(risk.severityCounts.CRITICAL).toBeGreaterThan(0);
  });
});

function resourceChange(address: string, type: string, actions: string[]) {
  return {
    address,
    type,
    name: address.split(".").at(-1) ?? "resource",
    provider_name: "registry.terraform.io/hashicorp/aws",
    change: {
      actions,
      before: null,
      after: {
        tags: {
          owner: "platform",
          service: "web",
          environment: "dev"
        }
      }
    }
  };
}
