import type { ReactNode } from "react";
import { CircleAlert, Info, TriangleAlert } from "lucide-react";

type Tone = "error" | "warning" | "info";

type Props = {
  tone?: Tone;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function StatusMessage({ tone = "info", title, description, action, className = "" }: Props) {
  const Icon = tone === "error" ? CircleAlert : tone === "warning" ? TriangleAlert : Info;

  return (
    <div className={`status-message status-message--${tone} ${className}`} role={tone === "error" ? "alert" : "status"}>
      <Icon className="status-message__icon" size={18} aria-hidden="true" />
      <div className="status-message__copy">
        <strong>{title}</strong>
        {description && <span>{description}</span>}
      </div>
      {action && <div className="status-message__action">{action}</div>}
    </div>
  );
}
