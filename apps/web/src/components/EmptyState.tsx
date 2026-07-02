import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-state__mark" aria-hidden="true" />
      <div>
        <h3>{title}</h3>
        {description === undefined ? null : <p>{description}</p>}
      </div>
      {action === undefined ? null : (
        <div className="empty-state__action">{action}</div>
      )}
    </div>
  );
}
