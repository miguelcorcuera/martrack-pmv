import { type ReactNode } from "react";

export function PageHeader({
  title, description, actions,
}: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-border bg-card px-8 py-6 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PageBody({ children }: { children: ReactNode }) {
  return <div className="p-8">{children}</div>;
}

export function StatusBadge({ value, tone = "neutral" }: {
  value: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  const styles: Record<string, string> = {
    neutral: "bg-muted text-muted-foreground border-border",
    success: "bg-success/10 text-success border-success/20",
    warning: "bg-warning/15 text-warning-foreground border-warning/30",
    danger:  "bg-destructive/10 text-destructive border-destructive/20",
    info:    "bg-accent text-accent-foreground border-border",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${styles[tone]}`}>
      {value}
    </span>
  );
}

export function statusTone(s: string | null | undefined): "neutral" | "success" | "warning" | "danger" | "info" {
  if (!s) return "neutral";
  if (["active","activo","available","disponible","signed","firmado","closed","cerrado"].includes(s)) return "success";
  if (["pending","pendiente","pending_signature","pending_review","pending_supervisor","evidencias_pendientes","review","revision","maintenance","mantenimiento","draft","borrador"].includes(s)) return "warning";
  if (["inactive","inactivo","blocked","bloqueado","retired","baja","out_of_service","cancelled","cancelado"].includes(s)) return "danger";
  if (["assigned","asignado"].includes(s)) return "info";
  return "neutral";
}
