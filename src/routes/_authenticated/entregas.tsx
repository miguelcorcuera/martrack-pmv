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

  const { data, isLoading } = useQuery({
    queryKey: ["deliveries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_deliveries")
        .select("*, vehicles(plate,brand,model), municipalities(name), supervisor:supervisor_employee_id(full_name), recipient:recipient_employee_id(full_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: vehicles } = useQuery({
    queryKey: ["veh-lite"],
    queryFn: async () => (await supabase.from("vehicles").select("id,plate,brand,model,municipality_id").order("plate")).data ?? [],
  });
  const { data: supervisors } = useQuery({
    queryKey: ["sup-lite"],
    queryFn: async () => (await supabase.from("employees")
      .select("id,full_name,role_operational,municipality_id,municipalities(name)")
      .eq("status","activo")
      .in("role_operational",["supervisor","coordinador"])
      .order("full_name")).data ?? [],
  });
  const { data: receivers } = useQuery({
    queryKey: ["recv-lite"],
    queryFn: async () => (await supabase.from("employees")
      .select("id,full_name,role_operational")
      .eq("status","activo").order("full_name")).data ?? [],
  });

  const createDelivery = async (f: any) => {
    if (!f.vehicle_id || !f.supervisor_employee_id || !f.recipient_employee_id || !f.delivery_date) {
      toast.error("Vehículo, supervisor, receptor y fecha son obligatorios"); return;
    }
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("vehicle_deliveries").insert({
      vehicle_id: f.vehicle_id,
      municipality_id: f.municipality_id ?? null,
      coordinator_user_id: u.user?.id ?? null,
      supervisor_employee_id: f.supervisor_employee_id,
      recipient_employee_id: f.recipient_employee_id,
      delivery_date: f.delivery_date,
      observations: f.observations ?? null,
      status: "pendiente_firma",
    }).select().single();
    if (error) return toast.error(error.message);
    await logAudit({ entity_type: "delivery", entity_id: data.id, action: "entrega_creada", actor_role: role, new_value: f });
    toast.success("Entrega creada"); setOpen(false);
    qc.invalidateQueries({ queryKey: ["deliveries"] });
  };

  return (
    <>
      <PageHeader
        title="Entregas"
        description="Asignaciones y entregas controladas con firma del supervisor."
        actions={canCreate && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" />Nueva entrega</Button></DialogTrigger>
            <NewDeliveryDialog vehicles={vehicles ?? []} supervisors={supervisors ?? []} receivers={receivers ?? []} onSubmit={createDelivery} />
          </Dialog>
        )}
      />
      <PageBody>
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Vehículo</th>
                <th className="px-4 py-3">Ayuntamiento</th>
                <th className="px-4 py-3">Supervisor</th>
                <th className="px-4 py-3">Receptor</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Cargando…</td></tr>}
              {!isLoading && (data ?? []).length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Sin entregas aún.</td></tr>}
              {(data ?? []).map((d: any) => (
                <tr key={d.id} className="hover:bg-accent/30">
                  <td className="px-4 py-3 text-muted-foreground">{format(new Date(d.delivery_date), "yyyy-MM-dd")}</td>
                  <td className="px-4 py-3 font-medium">{d.vehicles?.plate} · {d.vehicles?.brand} {d.vehicles?.model}</td>
                  <td className="px-4 py-3">{d.municipalities?.name ?? "—"}</td>
                  <td className="px-4 py-3">{d.supervisor?.full_name ?? "—"}</td>
                  <td className="px-4 py-3">{d.recipient?.full_name ?? "—"}</td>
                  <td className="px-4 py-3"><StatusBadge value={d.status} tone={statusTone(d.status)} /></td>
                  <td className="px-4 py-3 text-right">
                    <Button asChild variant="ghost" size="sm"><Link to="/entregas/$id" params={{ id: d.id }}>Abrir</Link></Button>
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

function NewDeliveryDialog({ vehicles, supervisors, receivers, onSubmit }: any) {
  const [f, setF] = useState<any>({ delivery_date: new Date().toISOString().slice(0,10) });
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const selectedVehicle = vehicles.find((v: any) => v.id === f.vehicle_id);

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Nueva entrega</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Vehículo *</Label>
          <Select value={f.vehicle_id ?? ""} onValueChange={(v) => { set("vehicle_id", v); const veh = vehicles.find((x:any)=>x.id===v); if(veh) set("municipality_id", veh.municipality_id); }}>
            <SelectTrigger><SelectValue placeholder="Selecciona vehículo" /></SelectTrigger>
            <SelectContent>{vehicles.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.plate} · {v.brand} {v.model}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Supervisor *</Label>
          {supervisors.length === 0
            ? <p className="text-sm text-muted-foreground">No hay supervisores activos disponibles. Crea o activa un empleado con perfil supervisor.</p>
            : (
              <Select value={f.supervisor_employee_id ?? ""} onValueChange={(v) => set("supervisor_employee_id", v)}>
                <SelectTrigger><SelectValue placeholder="Selecciona supervisor" /></SelectTrigger>
                <SelectContent>
                  {supervisors.map((s: any) =>
                    <SelectItem key={s.id} value={s.id}>{s.full_name} · {s.role_operational} · {s.municipalities?.name ?? "—"}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            )}
        </div>
        <div>
          <Label>Receptor / responsable *</Label>
          <Select value={f.recipient_employee_id ?? ""} onValueChange={(v) => set("recipient_employee_id", v)}>
            <SelectTrigger><SelectValue placeholder="Selecciona empleado receptor" /></SelectTrigger>
            <SelectContent>{receivers.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name} · {e.role_operational ?? "—"}</SelectItem>)}</SelectContent>
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
        {selectedVehicle && <p className="text-xs text-muted-foreground">Ayuntamiento heredado del vehículo.</p>}
      </div>
      <DialogFooter><Button onClick={() => onSubmit(f)}>Crear entrega</Button></DialogFooter>
    </DialogContent>
  );
}
