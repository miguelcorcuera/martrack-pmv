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
import type { Vehicle, Municipality, Employee } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/vehiculos")({ component: VehiclesPage });

const STATUSES = ["disponible","asignado","mantenimiento","baja","revision"] as const;
const FUELS = ["gasolina","diesel","hibrido","electrico","glp"] as const;

function VehiclesPage() {
  const qc = useQueryClient();
  const { isRoot, isCoordinator, role } = useAuth();
  const canEdit = isRoot || isCoordinator;
  const [search, setSearch] = useState("");
  const [muniFilter, setMuniFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [open, setOpen] = useState(false);

  const { data: munis } = useQuery({
    queryKey: ["munis-lite"],
    queryFn: async () => (await supabase.from("municipalities").select("id,name").order("name")).data as Pick<Municipality,"id"|"name">[],
  });
  const { data: emps } = useQuery({
    queryKey: ["emps-lite"],
    queryFn: async () => (await supabase.from("employees").select("id,full_name,role_operational,status").eq("status","activo").order("full_name")).data as Pick<Employee,"id"|"full_name"|"role_operational"|"status">[],
  });
  const { data, isLoading } = useQuery({
    queryKey: ["vehicles", muniFilter, statusFilter],
    queryFn: async () => {
      let q = supabase.from("vehicles").select("*, municipalities(name), employees:current_responsible_employee_id(full_name)").order("plate");
      if (muniFilter !== "all") q = q.eq("municipality_id", muniFilter);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
  });

  const filtered = (data ?? []).filter((v) =>
    [v.plate, v.brand, v.model].join(" ").toLowerCase().includes(search.toLowerCase())
  );

  const onSubmit = async (form: Partial<Vehicle>) => {
    if (!form.plate?.trim() || !form.brand?.trim() || !form.model?.trim()) {
      toast.error("Matrícula, marca y modelo son obligatorios"); return;
    }
    const payload = {
      plate: form.plate.trim(), brand: form.brand, model: form.model,
      year: form.year ?? null, registration_date: form.registration_date ?? null,
      color: form.color ?? null, engine: form.engine ?? null,
      fuel: form.fuel ?? "diesel", mileage: form.mileage ?? 0,
      municipality_id: form.municipality_id ?? null,
      status: form.status ?? "disponible",
      current_responsible_employee_id: form.current_responsible_employee_id ?? null,
      observations: form.observations ?? null,
    };
    if (editing) {
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
    qc.invalidateQueries({ queryKey: ["vehicles"] });
  };

  return (
    <>
      <PageHeader
        title="Vehículos"
        description="Listado completo de la flota."
        actions={canEdit && (
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditing(null)}><Plus className="mr-1 h-4 w-4" />Nuevo</Button>
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
              {(munis ?? []).map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Estado" /></SelectTrigger>
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
                <th className="px-4 py-3">Combustible</th>
                <th className="px-4 py-3">Km</th>
                <th className="px-4 py-3">Ayuntamiento</th>
                <th className="px-4 py-3">Responsable</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">Cargando…</td></tr>}
              {!isLoading && filtered.length === 0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">Sin resultados.</td></tr>}
              {filtered.map((v) => (
                <tr key={v.id} className="hover:bg-accent/30">
                  <td className="px-4 py-3 font-mono font-medium">{v.plate}</td>
                  <td className="px-4 py-3">{v.brand} {v.model}</td>
                  <td className="px-4 py-3 text-muted-foreground">{v.year ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{v.fuel}</td>
                  <td className="px-4 py-3 text-muted-foreground">{v.mileage?.toLocaleString() ?? 0}</td>
                  <td className="px-4 py-3">{v.municipalities?.name ?? "—"}</td>
                  <td className="px-4 py-3">{v.employees?.full_name ?? "—"}</td>
                  <td className="px-4 py-3"><StatusBadge value={v.status} tone={statusTone(v.status)} /></td>
                  <td className="px-4 py-3 text-right">
                    {canEdit && <Button variant="ghost" size="sm" onClick={() => { setEditing(v); setOpen(true); }}>Editar</Button>}
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
  editing: Vehicle | null;
  munis: Pick<Municipality,"id"|"name">[];
  emps: Pick<Employee,"id"|"full_name"|"role_operational"|"status">[];
  onSubmit: (f: Partial<Vehicle>) => void;
}) {
  const [f, setF] = useState<Partial<Vehicle>>(editing ?? { fuel: "diesel", status: "disponible", mileage: 0 });
  const set = (k: keyof Vehicle, v: any) => setF((p) => ({ ...p, [k]: v }));
  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>{editing ? "Editar vehículo" : "Nuevo vehículo"}</DialogTitle></DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Matrícula *</Label><Input value={f.plate ?? ""} onChange={(e) => set("plate", e.target.value)} /></div>
        <div><Label>Año</Label><Input type="number" value={f.year ?? ""} onChange={(e) => set("year", Number(e.target.value) || null)} /></div>
        <div><Label>Marca *</Label><Input value={f.brand ?? ""} onChange={(e) => set("brand", e.target.value)} /></div>
        <div><Label>Modelo *</Label><Input value={f.model ?? ""} onChange={(e) => set("model", e.target.value)} /></div>
        <div><Label>Color</Label><Input value={f.color ?? ""} onChange={(e) => set("color", e.target.value)} /></div>
        <div><Label>Motor</Label><Input value={f.engine ?? ""} onChange={(e) => set("engine", e.target.value)} /></div>
        <div>
          <Label>Combustible</Label>
          <Select value={f.fuel ?? "diesel"} onValueChange={(v) => set("fuel", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{FUELS.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Kilometraje</Label><Input type="number" value={f.mileage ?? 0} onChange={(e) => set("mileage", Number(e.target.value))} /></div>
        <div>
          <Label>Ayuntamiento</Label>
          <Select value={f.municipality_id ?? ""} onValueChange={(v) => set("municipality_id", v)}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{munis.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Estado</Label>
          <Select value={f.status ?? "disponible"} onValueChange={(v) => set("status", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="col-span-2">
          <Label>Responsable actual</Label>
          <Select value={f.current_responsible_employee_id ?? ""} onValueChange={(v) => set("current_responsible_employee_id", v || null)}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{emps.map((e) => <SelectItem key={e.id} value={e.id}>{e.full_name} · {e.role_operational}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="col-span-2"><Label>Observaciones</Label><Textarea rows={3} value={f.observations ?? ""} onChange={(e) => set("observations", e.target.value)} /></div>
      </div>
      <DialogFooter><Button onClick={() => onSubmit(f)}>{editing ? "Guardar cambios" : "Crear"}</Button></DialogFooter>
    </DialogContent>
  );
}
