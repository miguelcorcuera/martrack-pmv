import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Car, Building2, Users, ClipboardList, Image as ImageIcon, KeyRound, ShieldCheck, FileSignature } from "lucide-react";
import { PageBody, PageHeader, StatusBadge, statusTone } from "@/components/page";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: DashboardPage });

function StatCard({ label, value, icon, hint }: { label: string; value: number | string; icon: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        <div className="text-muted-foreground">{icon}</div>
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight">{value}</div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function DashboardPage() {
  const { fullName, role } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const counts = async (table: string, filter?: (q: any) => any) => {
        let q = supabase.from(table).select("id", { count: "exact", head: true });
        if (filter) q = filter(q);
        const { count } = await q;
        return count ?? 0;
      };
      const [
        vehicles, vehiclesAvail, vehiclesAssigned, vehiclesRevision,
        deliveriesPending, deliveriesDone,
        evidence, municipalities, employeesActive,
      ] = await Promise.all([
        counts("vehicles"),
        counts("vehicles", (q) => q.eq("status","disponible")),
        counts("vehicles", (q) => q.eq("status","asignado")),
        counts("vehicles", (q) => q.eq("status","revision")),
        counts("vehicle_deliveries", (q) => q.eq("status","pendiente_firma")),
        counts("vehicle_deliveries", (q) => q.in("status",["firmado","cerrado"])),
        counts("vehicle_evidence", (q) => q.eq("is_deleted", false)),
        counts("municipalities", (q) => q.eq("status","activo")),
        counts("employees", (q) => q.eq("status","activo")),
      ]);

      const [{ data: lastDeliveries }, { data: lastEvidence }, { data: lastAudit }] = await Promise.all([
        supabase.from("vehicle_deliveries").select("id, delivery_date, status, vehicle_id, vehicles(plate, brand, model)").order("created_at",{ascending:false}).limit(5),
        supabase.from("vehicle_evidence").select("id, file_name, created_at").eq("is_deleted",false).order("created_at",{ascending:false}).limit(5),
        supabase.from("audit_log").select("id, action, description, created_at").order("created_at",{ascending:false}).limit(8),
      ]);

      return {
        vehicles, vehiclesAvail, vehiclesAssigned, vehiclesRevision,
        deliveriesPending, deliveriesDone, evidence, municipalities, employeesActive,
        lastDeliveries: lastDeliveries ?? [], lastEvidence: lastEvidence ?? [],
        lastAudit: lastAudit ?? [],
      };
    },
  });

  return (
    <>
      <PageHeader title={`Hola, ${fullName ?? "usuario"}`} description={`Sesión activa con rol ${role ?? "—"}.`} />
      <PageBody>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          <StatCard label="Vehículos totales" value={isLoading ? "—" : data!.vehicles} icon={<Car className="h-4 w-4" />} />
          <StatCard label="Disponibles" value={isLoading ? "—" : data!.vehiclesAvail} icon={<Car className="h-4 w-4" />} />
          <StatCard label="Asignados" value={isLoading ? "—" : data!.vehiclesAssigned} icon={<Car className="h-4 w-4" />} />
          <StatCard label="En revisión" value={isLoading ? "—" : data!.vehiclesRevision} icon={<Car className="h-4 w-4" />} />
          <StatCard label="Entregas pendientes firma" value={isLoading ? "—" : data!.deliveriesPending} icon={<FileSignature className="h-4 w-4" />} />
          <StatCard label="Entregas completadas" value={isLoading ? "—" : data!.deliveriesDone} icon={<ClipboardList className="h-4 w-4" />} />
          <StatCard label="Evidencias activas" value={isLoading ? "—" : data!.evidence} icon={<ImageIcon className="h-4 w-4" />} />
          <StatCard label="Ayuntamientos activos" value={isLoading ? "—" : data!.municipalities} icon={<Building2 className="h-4 w-4" />} />
          <StatCard label="Empleados activos" value={isLoading ? "—" : data!.employeesActive} icon={<Users className="h-4 w-4" />} />
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-5 py-3 text-sm font-medium">Últimas entregas</div>
            <div className="divide-y divide-border">
              {(data?.lastDeliveries ?? []).map((d: any) => (
                <Link key={d.id} to="/entregas/$id" params={{ id: d.id }} className="flex items-center justify-between px-5 py-3 text-sm hover:bg-accent/40">
                  <div>
                    <div className="font-medium">{d.vehicles?.plate ?? "—"} · {d.vehicles?.brand} {d.vehicles?.model}</div>
                    <div className="text-xs text-muted-foreground">{format(new Date(d.delivery_date), "yyyy-MM-dd")}</div>
                  </div>
                  <StatusBadge value={d.status} tone={statusTone(d.status)} />
                </Link>
              ))}
              {!isLoading && data?.lastDeliveries.length === 0 && (
                <div className="px-5 py-8 text-center text-sm text-muted-foreground">Sin entregas aún.</div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-5 py-3 text-sm font-medium">Auditoría reciente</div>
            <div className="divide-y divide-border">
              {(data?.lastAudit ?? []).map((a: any) => (
                <div key={a.id} className="px-5 py-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{a.action}</span>
                    <span className="text-[11px] text-muted-foreground">{format(new Date(a.created_at), "yyyy-MM-dd HH:mm")}</span>
                  </div>
                  {a.description && <p className="mt-0.5 text-xs text-muted-foreground">{a.description}</p>}
                </div>
              ))}
              {!isLoading && data?.lastAudit.length === 0 && (
                <div className="px-5 py-8 text-center text-sm text-muted-foreground">Sin eventos.</div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <Link to="/vehiculos" className="rounded border border-border px-2 py-1 hover:bg-accent">Ir a vehículos</Link>
          <Link to="/entregas" className="rounded border border-border px-2 py-1 hover:bg-accent">Ir a entregas</Link>
          <Link to="/accesos" className="rounded border border-border px-2 py-1 hover:bg-accent">Admin. accesos</Link>
          <Link to="/auditoria" className="rounded border border-border px-2 py-1 hover:bg-accent"><ShieldCheck className="mr-1 inline h-3 w-3" />Auditoría completa</Link>
          <Link to="/accesos" className="rounded border border-border px-2 py-1 hover:bg-accent"><KeyRound className="mr-1 inline h-3 w-3" />Crear usuario</Link>
        </div>
      </PageBody>
    </>
  );
}
