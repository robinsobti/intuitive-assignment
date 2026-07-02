import type {
  Recommendation,
  RiskLevel,
  Severity,
  SeverityCounts
} from "@infra-review/shared";
import type { PolicyFinding } from "./policies.js";
import type { TerraformChangeSummary } from "./terraformPlan.js";

export type RiskCalculation = {
  riskScore: number;
  riskLevel: RiskLevel;
  severityCounts: SeverityCounts;
  recommendation: Recommendation;
};

const actionScores = {
  create: 1,
  update: 2,
  delete: 10,
  replace: 12,
  unknown: 3
} as const;

const findingScores: Record<Severity, number> = {
  LOW: 3,
  MEDIUM: 10,
  HIGH: 25,
  CRITICAL: 40
};

export function calculateRisk(
  summary: TerraformChangeSummary,
  findings: Pick<PolicyFinding, "severity">[]
): RiskCalculation {
  const severityCounts = countSeverities(findings);
  const uncappedScore =
    summary.create * actionScores.create +
    summary.update * actionScores.update +
    summary.delete * actionScores.delete +
    summary.replace * actionScores.replace +
    summary.unknown * actionScores.unknown +
    findings.reduce(
      (total, finding) => total + findingScores[finding.severity],
      0
    );
  const riskScore = Math.min(100, uncappedScore);

  return {
    riskScore,
    riskLevel: riskLevelForScore(riskScore),
    severityCounts,
    recommendation: recommendationForRisk(summary, severityCounts, riskScore)
  };
}

function countSeverities(
  findings: Pick<PolicyFinding, "severity">[]
): SeverityCounts {
  const counts: SeverityCounts = {
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
    CRITICAL: 0
  };

  for (const finding of findings) {
    counts[finding.severity] += 1;
  }

  return counts;
}

function riskLevelForScore(score: number): RiskLevel {
  if (score >= 80) {
    return "CRITICAL";
  }

  if (score >= 50) {
    return "HIGH";
  }

  if (score >= 25) {
    return "MEDIUM";
  }

  return "LOW";
}

function recommendationForRisk(
  summary: TerraformChangeSummary,
  severityCounts: SeverityCounts,
  score: number
): Recommendation {
  if (score >= 80 || severityCounts.CRITICAL > 0) {
    return "BLOCK";
  }

  if (
    score < 25 &&
    severityCounts.HIGH === 0 &&
    summary.delete === 0 &&
    summary.replace === 0
  ) {
    return "APPROVE";
  }

  return "REVIEW";
}
