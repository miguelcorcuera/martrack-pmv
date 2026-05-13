import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageBody, PageHeader, StatusBadge, statusTone } from "@/components/page";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/accesos")({ component: AccessAdminPage });

function AccessAdminPage() {
  const { isRoot } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["access-admin-overview"],
    queryFn: async () => (await supabase.from("v_access_admin_overview").select("*").order("profile_full_name")).data ?? [],
  });

  if (!isRoot) {
    return (
      <>
        <PageHeader title="Administración de accesos" description="Solo root puede ver esta sección." />
        <PageBody><p className="text-sm text-muted-foreground">No tienes permisos para esta sección.</p></PageBody>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Administración de accesos" description="Vista de accesos vinculados a empleados (solo lectura)." />
      <PageBody>
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Email acceso</th>
                <th className="px-4 py-3">Nombre perfil</th>
                <th className="px-4 py-3">Empleado</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Ayuntamiento</th>
                <th className="px-4 py-3">Acceso</th>
                <th className="px-4 py-3">Empleado est.</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Cargando…</td></tr>}
              {!isLoading && (data ?? []).length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Sin accesos.</td></tr>}
              {(data ?? []).map((r: any) => (
                <tr key={r.profile_id} className="hover:bg-accent/30">
                  <td className="px-4 py-3 font-medium">{r.access_email ?? "—"}</td>
                  <td className="px-4 py-3">{r.profile_full_name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.employee_full_name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{Array.isArray(r.system_roles) ? r.system_roles.join(", ") : (r.system_roles ?? "—")}</td>
                  <td className="px-4 py-3">{r.municipality_name ?? "—"}</td>
                  <td className="px-4 py-3"><StatusBadge value={r.access_status} tone={statusTone(r.access_status)} /></td>
                  <td className="px-4 py-3"><StatusBadge value={r.employee_status} tone={statusTone(r.employee_status)} /></td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {r.employee_id && (
                      <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/empleados" })}>Editar empleado</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageBody>
    </>
  );
}
