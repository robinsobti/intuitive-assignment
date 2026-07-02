import type { ReactNode } from "react";

type ErrorCalloutProps = {
  title?: string;
  message: string;
  action?: ReactNode;
  tone?: "danger" | "warning";
};

export function ErrorCallout({
  title = "Something went wrong",
  message,
  action,
  tone = "danger"
}: ErrorCalloutProps) {
  return (
    <div className={`error-callout error-callout--${tone}`} role="alert">
      <div>
        <h3>{title}</h3>
        <p>{message}</p>
      </div>
      {action === undefined ? null : (
        <div className="error-callout__action">{action}</div>
      )}
    </div>
  );
}
