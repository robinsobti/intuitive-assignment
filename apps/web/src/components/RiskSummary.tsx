import type { RunResult } from "@infra-review/shared";
import {
  formatRecommendation,
  formatRiskLevel
} from "../lib/formatting";

type RiskSummaryProps = {
  result: RunResult;
};

export function RiskSummary({ result }: RiskSummaryProps) {
  const riskLevelClass = `risk-level--${result.riskLevel.toLowerCase()}`;

  return (
    <div className="risk-summary">
      <div className={`risk-summary__score ${riskLevelClass}`}>
        <span>Risk score</span>
        <strong>{result.riskScore}</strong>
        <p>{formatRiskLevel(result.riskLevel)}</p>
      </div>
      <dl className="risk-summary__metrics">
        <div>
          <dt>Recommendation</dt>
          <dd>{formatRecommendation(result.recommendation)}</dd>
        </div>
        <div>
          <dt>Findings</dt>
          <dd>{result.findings.length}</dd>
        </div>
        <div>
          <dt>Resource changes</dt>
          <dd>{result.summary.total}</dd>
        </div>
        <div>
          <dt>Critical</dt>
          <dd>{result.severityCounts.CRITICAL}</dd>
        </div>
        <div>
          <dt>High</dt>
          <dd>{result.severityCounts.HIGH}</dd>
        </div>
      </dl>
    </div>
  );
}
