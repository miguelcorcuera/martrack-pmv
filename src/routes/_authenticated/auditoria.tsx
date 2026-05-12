import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageBody, PageHeader } from "@/components/page";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/auditoria")({ component: AuditPage });

function AuditPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["audit"],
    queryFn: async () => (await supabase.from("audit_log").select("*").order("created_at",{ascending:false}).limit(200)).data ?? [],
  });
  return (
    <>
      <PageHeader title="Auditoría" description="Últimos 200 eventos registrados." />
      <PageBody>
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Acción</th>
                <th className="px-4 py-3">Entidad</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Descripción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Cargando…</td></tr>}
              {(data ?? []).map((a: any) => (
                <tr key={a.id} className="hover:bg-accent/30">
                  <td className="px-4 py-3 text-xs text-muted-foreground">{format(new Date(a.created_at), "yyyy-MM-dd HH:mm:ss")}</td>
                  <td className="px-4 py-3 font-medium">{a.action}</td>
                  <td className="px-4 py-3 text-muted-foreground">{a.entity_type}</td>
                  <td className="px-4 py-3 text-muted-foreground">{a.actor_role ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{a.description ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageBody>
    </>
  );
}
