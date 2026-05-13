import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { PageBody, PageHeader, StatusBadge, statusTone } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { logAudit } from "@/lib/audit";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/vehiculos")({ component: VehiclesPage });

const STATUSES = ["available", "assigned", "pending_review", "maintenance", "out_of_service"] as const;
const FUELS = ["Gasoline", "Diesel", "Hybrid", "Electric", "LPG"] as const;

interface VehicleForm {
  id?: string;
  license_plate?: string;
  brand?: string;
  model?: string;
  vehicle_year?: number | null;
  registration_date?: string | null;
  color?: string | null;
  engine_type?: string | null;
  fuel_type?: string | null;
  mileage?: number;
  status?: string;
  municipality_id?: string | null;
  current_responsible_employee_id?: string | null;
  observations?: string | null;
  is_active?: boolean;
}

function VehiclesPage() {
  const qc = useQueryClient();
  const { isRoot, isCoordinator, role } = useAuth();
  const canEdit = isRoot || isCoordinator;
  const [search, setSearch] = useState("");
  const [muniFilter, setMuniFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editing, setEditing] = useState<VehicleForm | null>(null);
  const [open, setOpen] = useState(false);

  const { data: munis } = useQuery({
    queryKey: ["munis-lite"],
    queryFn: async () => (await supabase.from("municipalities").select("id,name,status").order("name")).data ?? [],
  });
  const { data: emps } = useQuery({
    queryKey: ["emps-active-lite"],
    queryFn: async () => (await supabase.from("v_active_employees").select("id,full_name,role_operational,municipality_name").order("full_name")).data ?? [],
  });
  const { data, isLoading } = useQuery({
    queryKey: ["vehicles-overview", muniFilter, statusFilter],
    queryFn: async () => {
      let q = supabase.from("v_vehicle_overview").select("*").order("license_plate");
      if (muniFilter !== "all") q = q.eq("municipality_id", muniFilter);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });

  const filtered = (data ?? []).filter((v) =>
    [v.license_plate, v.brand, v.model].join(" ").toLowerCase().includes(search.toLowerCase())
  );

  const onSubmit = async (form: VehicleForm) => {
    if (!form.license_plate?.trim() || !form.brand?.trim() || !form.model?.trim()) {
      toast.error("Matrícula, marca y modelo son obligatorios"); return;
    }
    const payload: Record<string, unknown> = {
      license_plate: form.license_plate.trim(),
      brand: form.brand,
      model: form.model,
      vehicle_year: form.vehicle_year ?? null,
      registration_date: form.registration_date || null,
      color: form.color ?? null,
      engine_type: form.engine_type ?? null,
      fuel_type: form.fuel_type ?? null,
      mileage: form.mileage ?? 0,
      municipality_id: form.municipality_id || null,
      status: form.status ?? "available",
      current_responsible_employee_id: form.current_responsible_employee_id || null,
      observations: form.observations ?? null,
      is_active: form.is_active ?? true,
    };
    if (editing?.id) {
      const { error } = await supabase.from("vehicles").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      await logAudit({ entity_type: "vehicle", entity_id: editing.id, action: "vehiculo_actualizado", actor_role: role, new_value: payload });
      toast.success("Vehículo actualizado");
    } else {
      const { data, error } = await supabase.from("vehicles").insert(payload).select().single();
      if (error) return toast.error(error.message);
      await logAudit({ entity_type: "vehicle", entity_id: data.id, action: "vehiculo_creado", actor_role: role, new_value: payload });
      toast.success("Vehículo creado");
    }
    setEditing(null); setOpen(false);
    qc.invalidateQueries({ queryKey: ["vehicles-overview"] });
  };

  const openEdit = async (row: any) => {
    const { data, error } = await supabase.from("vehicles").select("*").eq("id", row.id).single();
    if (error) return toast.error(error.message);
    setEditing(data as VehicleForm);
    setOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Vehículos"
        description="Listado completo de la flota."
        actions={canEdit && (
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditing(null)}><Plus className="mr-1 h-4 w-4" />Nuevo vehículo</Button>
            </DialogTrigger>
            <VehicleDialog editing={editing} munis={munis ?? []} emps={emps ?? []} onSubmit={onSubmit} />
          </Dialog>
        )}
      />
      <PageBody>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Input placeholder="Buscar matrícula, marca, modelo…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
          <Select value={muniFilter} onValueChange={setMuniFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Ayuntamiento" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los ayuntamientos</SelectItem>
              {(munis ?? []).map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Matrícula</th>
                <th className="px-4 py-3">Marca / Modelo</th>
                <th className="px-4 py-3">Año</th>
                <th className="px-4 py-3">Ayuntamiento</th>
                <th className="px-4 py-3">Responsable</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Km</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Cargando…</td></tr>}
              {!isLoading && filtered.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Sin resultados.</td></tr>}
              {filtered.map((v: any) => (
                <tr key={v.id} className="hover:bg-accent/30">
                  <td className="px-4 py-3 font-mono font-medium">{v.license_plate}</td>
                  <td className="px-4 py-3">{v.brand} {v.model}</td>
                  <td className="px-4 py-3 text-muted-foreground">{v.vehicle_year ?? "—"}</td>
                  <td className="px-4 py-3">{v.municipality_name ?? "—"}</td>
                  <td className="px-4 py-3">{v.current_responsible_name ?? "—"}</td>
                  <td className="px-4 py-3"><StatusBadge value={v.status} tone={statusTone(v.status)} /></td>
                  <td className="px-4 py-3 text-muted-foreground">{(v.mileage ?? 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    {canEdit && <Button variant="ghost" size="sm" onClick={() => openEdit(v)}>Editar</Button>}
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

function VehicleDialog({ editing, munis, emps, onSubmit }: {
  editing: VehicleForm | null;
  munis: any[];
  emps: any[];
  onSubmit: (f: VehicleForm) => void;
}) {
  const [f, setF] = useState<VehicleForm>(editing ?? { fuel_type: "Diesel", status: "available", mileage: 0, is_active: true });
  const set = <K extends keyof VehicleForm>(k: K, v: VehicleForm[K]) => setF((p) => ({ ...p, [k]: v }));

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>{editing?.id ? "Editar vehículo" : "Nuevo vehículo"}</DialogTitle></DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Matrícula *</Label><Input value={f.license_plate ?? ""} onChange={(e) => set("license_plate", e.target.value)} /></div>
        <div><Label>Año</Label><Input type="number" value={f.vehicle_year ?? ""} onChange={(e) => set("vehicle_year", Number(e.target.value) || null)} /></div>
        <div><Label>Marca *</Label><Input value={f.brand ?? ""} onChange={(e) => set("brand", e.target.value)} /></div>
        <div><Label>Modelo *</Label><Input value={f.model ?? ""} onChange={(e) => set("model", e.target.value)} /></div>
        <div><Label>Color</Label><Input value={f.color ?? ""} onChange={(e) => set("color", e.target.value)} /></div>
        <div><Label>Motor</Label><Input value={f.engine_type ?? ""} onChange={(e) => set("engine_type", e.target.value)} /></div>
        <div>
          <Label>Combustible</Label>
          <Select value={f.fuel_type ?? "Diesel"} onValueChange={(v) => set("fuel_type", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{FUELS.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Kilometraje</Label><Input type="number" value={f.mileage ?? 0} onChange={(e) => set("mileage", Number(e.target.value))} /></div>
        <div><Label>Fecha matriculación</Label><Input type="date" value={f.registration_date ?? ""} onChange={(e) => set("registration_date", e.target.value)} /></div>
        <div>
          <Label>Estado</Label>
          <Select value={f.status ?? "available"} onValueChange={(v) => set("status", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Ayuntamiento</Label>
          <Select value={f.municipality_id ?? ""} onValueChange={(v) => set("municipality_id", v)}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{munis.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Responsable actual</Label>
          <Select value={f.current_responsible_employee_id ?? ""} onValueChange={(v) => set("current_responsible_employee_id", v || null)}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{emps.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name} · {e.role_operational ?? "—"}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="col-span-2"><Label>Observaciones</Label><Textarea rows={3} value={f.observations ?? ""} onChange={(e) => set("observations", e.target.value)} /></div>
      </div>
      <DialogFooter><Button onClick={() => onSubmit(f)}>{editing?.id ? "Guardar cambios" : "Crear"}</Button></DialogFooter>
    </DialogContent>
  );
}
