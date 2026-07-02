import type { ReactNode } from "react";

type ErrorCalloutProps = {
  title?: string;
  message: string;
  action?: ReactNode;
};

export function ErrorCallout({
  title = "Something went wrong",
  message,
  action
}: ErrorCalloutProps) {
  return (
    <div className="error-callout" role="alert">
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
