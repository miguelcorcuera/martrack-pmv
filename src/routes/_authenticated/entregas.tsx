import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { PageBody, PageHeader, StatusBadge, statusTone } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { logAudit } from "@/lib/audit";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/entregas")({ component: DeliveriesPage });

function DeliveriesPage() {
  const qc = useQueryClient();
  const { isRoot, isCoordinator, role } = useAuth();
  const canCreate = isRoot || isCoordinator;
  const [open, setOpen] = useState(false);
  const [supDlg, setSupDlg] = useState<{ id: string; current?: string | null } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["deliveries-overview"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_delivery_overview")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: vehicles } = useQuery({
    queryKey: ["veh-overview-lite"],
    queryFn: async () => (await supabase.from("v_vehicle_overview").select("id,license_plate,brand,model,municipality_id").order("license_plate")).data ?? [],
  });
  const { data: supervisors } = useQuery({
    queryKey: ["sup-active"],
    queryFn: async () => (await supabase.from("v_active_supervisors").select("*").order("full_name")).data ?? [],
  });
  const { data: employees } = useQuery({
    queryKey: ["emps-active"],
    queryFn: async () => (await supabase.from("v_active_employees").select("id,full_name,role_operational").order("full_name")).data ?? [],
  });

  const createDelivery = async (f: any) => {
    if (!f.vehicle_id || !f.supervisor_employee_id || !f.receiver_employee_id || !f.delivery_date) {
      toast.error("Vehículo, supervisor, receptor y fecha son obligatorios"); return;
    }
    const payload = {
      vehicle_id: f.vehicle_id,
      municipality_id: f.municipality_id ?? null,
      coordinator_employee_id: f.coordinator_employee_id ?? null,
      supervisor_employee_id: f.supervisor_employee_id,
      receiver_employee_id: f.receiver_employee_id,
      delivery_date: f.delivery_date,
      delivery_status: f.delivery_status ?? "draft",
      observations: f.observations ?? null,
    };
    const { data, error } = await supabase.from("vehicle_deliveries").insert(payload).select().single();
    if (error) return toast.error(error.message);
    await logAudit({ entity_type: "delivery", entity_id: data.id, action: "entrega_creada", actor_role: role, new_value: payload });
    toast.success("Entrega creada"); setOpen(false);
    qc.invalidateQueries({ queryKey: ["deliveries-overview"] });
  };

  const changeSupervisor = async (delivery_id: string, supervisor_employee_id: string) => {
    const { error } = await supabase.rpc("assign_delivery_supervisor", { delivery_id, supervisor_employee_id });
    if (error) return toast.error(error.message);
    toast.success("Supervisor actualizado");
    setSupDlg(null);
    qc.invalidateQueries({ queryKey: ["deliveries-overview"] });
  };

  return (
    <>
      <PageHeader
        title="Entregas"
        description="Asignaciones y entregas controladas con firma del supervisor."
        actions={canCreate && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" />Nueva entrega</Button></DialogTrigger>
            <NewDeliveryDialog vehicles={vehicles ?? []} supervisors={supervisors ?? []} employees={employees ?? []} onSubmit={createDelivery} />
          </Dialog>
        )}
      />
      <PageBody>
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Matrícula</th>
                <th className="px-4 py-3">Vehículo</th>
                <th className="px-4 py-3">Ayuntamiento</th>
                <th className="px-4 py-3">Coordinador</th>
                <th className="px-4 py-3">Supervisor</th>
                <th className="px-4 py-3">Receptor</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Firma</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && <tr><td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">Cargando…</td></tr>}
              {!isLoading && (data ?? []).length === 0 && <tr><td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">Sin entregas aún.</td></tr>}
              {(data ?? []).map((d: any) => (
                <tr key={d.id} className="hover:bg-accent/30">
                  <td className="px-4 py-3 text-muted-foreground">{format(new Date(d.delivery_date), "yyyy-MM-dd")}</td>
                  <td className="px-4 py-3 font-mono">{d.license_plate}</td>
                  <td className="px-4 py-3">{d.brand} {d.model}</td>
                  <td className="px-4 py-3">{d.municipality_name ?? "—"}</td>
                  <td className="px-4 py-3">{d.coordinator_name ?? "—"}</td>
                  <td className="px-4 py-3">{d.supervisor_name ?? "—"}</td>
                  <td className="px-4 py-3">{d.receiver_name ?? "—"}</td>
                  <td className="px-4 py-3"><StatusBadge value={d.delivery_status} tone={statusTone(d.delivery_status)} /></td>
                  <td className="px-4 py-3 text-muted-foreground">{d.has_signature ? "Sí" : "—"}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Button asChild variant="ghost" size="sm"><Link to="/entregas/$id" params={{ id: d.id }}>Abrir</Link></Button>
                    {canCreate && (
                      <Button variant="ghost" size="sm" onClick={() => setSupDlg({ id: d.id, current: d.supervisor_employee_id })}>
                        Cambiar supervisor
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageBody>

      {supDlg && (
        <Dialog open onOpenChange={(o) => !o && setSupDlg(null)}>
          <ChangeSupervisorDialog
            current={supDlg.current ?? null}
            supervisors={supervisors ?? []}
            onSubmit={(sid) => changeSupervisor(supDlg.id, sid)}
          />
        </Dialog>
      )}
    </>
  );
}

function ChangeSupervisorDialog({ current, supervisors, onSubmit }: { current: string | null; supervisors: any[]; onSubmit: (id: string) => void }) {
  const [val, setVal] = useState(current ?? "");
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Cambiar supervisor</DialogTitle></DialogHeader>
      <div>
        <Label>Supervisor</Label>
        <Select value={val} onValueChange={setVal}>
          <SelectTrigger><SelectValue placeholder="Selecciona supervisor" /></SelectTrigger>
          <SelectContent>{supervisors.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.selector_label ?? s.full_name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <DialogFooter><Button onClick={() => val && onSubmit(val)} disabled={!val}>Guardar</Button></DialogFooter>
    </DialogContent>
  );
}

function NewDeliveryDialog({ vehicles, supervisors, employees, onSubmit }: any) {
  const [f, setF] = useState<any>({ delivery_date: new Date().toISOString().slice(0, 10), delivery_status: "draft" });
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Nueva entrega</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Vehículo *</Label>
          <Select value={f.vehicle_id ?? ""} onValueChange={(v) => { set("vehicle_id", v); const veh = vehicles.find((x: any) => x.id === v); if (veh) set("municipality_id", veh.municipality_id); }}>
            <SelectTrigger><SelectValue placeholder="Selecciona vehículo" /></SelectTrigger>
            <SelectContent>{vehicles.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.license_plate} · {v.brand} {v.model}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Coordinador</Label>
          <Select value={f.coordinator_employee_id ?? ""} onValueChange={(v) => set("coordinator_employee_id", v)}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name} · {e.role_operational ?? "—"}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Supervisor *</Label>
          {supervisors.length === 0
            ? <p className="text-sm text-muted-foreground">No hay supervisores activos disponibles.</p>
            : (
              <Select value={f.supervisor_employee_id ?? ""} onValueChange={(v) => set("supervisor_employee_id", v)}>
                <SelectTrigger><SelectValue placeholder="Selecciona supervisor" /></SelectTrigger>
                <SelectContent>
                  {supervisors.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.selector_label ?? s.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
        </div>
        <div>
          <Label>Receptor *</Label>
          <Select value={f.receiver_employee_id ?? ""} onValueChange={(v) => set("receiver_employee_id", v)}>
            <SelectTrigger><SelectValue placeholder="Selecciona empleado receptor" /></SelectTrigger>
            <SelectContent>{employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name} · {e.role_operational ?? "—"}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Fecha *</Label>
          <Input type="date" value={f.delivery_date} onChange={(e) => set("delivery_date", e.target.value)} />
        </div>
        <div>
          <Label>Observaciones</Label>
          <Textarea rows={3} value={f.observations ?? ""} onChange={(e) => set("observations", e.target.value)} />
        </div>
      </div>
      <DialogFooter><Button onClick={() => onSubmit(f)}>Crear entrega</Button></DialogFooter>
    </DialogContent>
  );
}
