import { APP_NAME } from "@infra-review/shared";
import { NewRunForm } from "../components/NewRunForm";
import { RunList } from "../components/RunList";
import { API_BASE_URL } from "../lib/api";

export default function HomePage() {
  return (
    <main className="workspace">
      <header className="app-header">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">
            IR
          </span>
          <div>
            <p className="eyebrow">Terraform plan review</p>
            <h1>{APP_NAME}</h1>
          </div>
        </div>
      </header>

      <section className="intro-section" aria-labelledby="intro-heading">
        <div className="intro-copy">
          <p className="section-kicker">Local review workspace</p>
          <h2 id="intro-heading">Find risky infrastructure changes before apply.</h2>
          <p>
            Submit Terraform plan JSON to run deterministic checks for
            destructive changes, public exposure, wildcard IAM permissions,
            missing ownership tags, and overall risk.
          </p>
        </div>
        <div className="api-target" aria-label="Configured API base URL">
          <span>API target</span>
          <code>{API_BASE_URL}</code>
        </div>
      </section>

      <div className="dashboard-grid">
        <NewRunForm />
        <RunList />
      </div>
    </main>
  );
}
