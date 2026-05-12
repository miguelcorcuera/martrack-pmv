import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageBody, PageHeader, StatusBadge, statusTone } from "@/components/page";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/_authenticated/empleados")({ component: EmployeesPage });

function EmployeesPage() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["employees-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*, municipalities(name)")
        .order("full_name");
      if (error) throw error;
      return data as any[];
    },
  });

  const filtered = (data ?? []).filter((e) => {
    if (roleFilter !== "all" && e.role_operational !== roleFilter) return false;
    if (statusFilter !== "all" && e.status !== statusFilter) return false;
    if (!search) return true;
    return [e.full_name, e.email, e.employee_code].join(" ").toLowerCase().includes(search.toLowerCase());
  });

  return (
    <>
      <PageHeader title="Empleados" description="40 empleados sintéticos. Crear y editar desde Administración de accesos." />
      <PageBody>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Input placeholder="Buscar nombre, email, código…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Perfil operativo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los perfiles</SelectItem>
              {["coordinador","supervisor","conductor","operario","administrativo","responsable_flota"].map((r) =>
                <SelectItem key={r} value={r}>{r}</SelectItem>
              )}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {["activo","pendiente","inactivo","bloqueado"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Código</th>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Perfil</th>
                <th className="px-4 py-3">Ayuntamiento</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Acceso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Cargando…</td></tr>}
              {!isLoading && filtered.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Sin resultados.</td></tr>}
              {filtered.map((e) => (
                <tr key={e.id} className="hover:bg-accent/30">
                  <td className="px-4 py-3 font-mono text-xs">{e.employee_code}</td>
                  <td className="px-4 py-3 font-medium">{e.full_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{e.email ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{e.role_operational ?? "—"}</td>
                  <td className="px-4 py-3">{e.municipalities?.name ?? "—"}</td>
                  <td className="px-4 py-3"><StatusBadge value={e.status} tone={statusTone(e.status)} /></td>
                  <td className="px-4 py-3"><StatusBadge value={e.access_status} tone={statusTone(e.access_status)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageBody>
    </>
  );
}
