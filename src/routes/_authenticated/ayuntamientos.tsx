import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { PageBody, PageHeader, StatusBadge, statusTone } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { logAudit } from "@/lib/audit";
import { useAuth } from "@/hooks/use-auth";
import type { Municipality } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/ayuntamientos")({ component: MunicipalitiesPage });

function MunicipalitiesPage() {
  const qc = useQueryClient();
  const { isRoot, isCoordinator, role } = useAuth();
  const canEdit = isRoot || isCoordinator;
  const [editing, setEditing] = useState<Municipality | null>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["municipalities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("municipalities").select("*").order("name");
      if (error) throw error;
      return data as Municipality[];
    },
  });

  const filtered = (data ?? []).filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase())
  );

  const onSubmit = async (form: Partial<Municipality>) => {
    if (!form.name?.trim()) { toast.error("Nombre obligatorio"); return; }
    if (editing) {
      const { error } = await supabase.from("municipalities").update({
        name: form.name, zone: form.zone ?? null,
        internal_responsible: form.internal_responsible ?? null,
        status: form.status ?? "activo",
        observations: form.observations ?? null,
      }).eq("id", editing.id);
      if (error) return toast.error(error.message);
      await logAudit({ entity_type: "municipality", entity_id: editing.id, action: "ayuntamiento_actualizado", actor_role: role, new_value: form });
      toast.success("Ayuntamiento actualizado");
    } else {
      const { data, error } = await supabase.from("municipalities").insert({
        name: form.name, zone: form.zone ?? null,
        internal_responsible: form.internal_responsible ?? null,
        status: form.status ?? "activo",
        observations: form.observations ?? null,
      }).select().single();
      if (error) return toast.error(error.message);
      await logAudit({ entity_type: "municipality", entity_id: data.id, action: "ayuntamiento_creado", actor_role: role, new_value: form });
      toast.success("Ayuntamiento creado");
    }
    setEditing(null); setOpen(false);
    qc.invalidateQueries({ queryKey: ["municipalities"] });
  };

  const toggleActive = async (m: Municipality) => {
    const newStatus = m.status === "activo" ? "inactivo" : "activo";
    const { error } = await supabase.from("municipalities").update({ status: newStatus }).eq("id", m.id);
    if (error) return toast.error(error.message);
    await logAudit({ entity_type: "municipality", entity_id: m.id, action: "ayuntamiento_actualizado", actor_role: role, new_value: { status: newStatus } });
    toast.success(`Estado: ${newStatus}`);
    qc.invalidateQueries({ queryKey: ["municipalities"] });
  };

  return (
    <>
      <PageHeader
        title="Ayuntamientos"
        description="Gestión de los 10 ayuntamientos de la flota."
        actions={canEdit && (
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditing(null)}><Plus className="mr-1 h-4 w-4" />Nuevo</Button>
            </DialogTrigger>
            <MuniDialog editing={editing} onSubmit={onSubmit} />
          </Dialog>
        )}
      />
      <PageBody>
        <div className="mb-4 flex items-center gap-2">
          <Input placeholder="Buscar…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        </div>
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Zona</th>
                <th className="px-4 py-3">Responsable interno</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Cargando…</td></tr>}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Sin resultados.</td></tr>
              )}
              {filtered.map((m) => (
                <tr key={m.id} className="hover:bg-accent/30">
                  <td className="px-4 py-3 font-medium">{m.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.zone ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.internal_responsible ?? "—"}</td>
                  <td className="px-4 py-3"><StatusBadge value={m.status} tone={statusTone(m.status)} /></td>
                  <td className="px-4 py-3 text-right">
                    {canEdit && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => { setEditing(m); setOpen(true); }}>Editar</Button>
                        <Button variant="ghost" size="sm" onClick={() => toggleActive(m)}>
                          {m.status === "activo" ? "Desactivar" : "Activar"}
                        </Button>
                      </>
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

function MuniDialog({ editing, onSubmit }: {
  editing: Municipality | null;
  onSubmit: (form: Partial<Municipality>) => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [zone, setZone] = useState(editing?.zone ?? "");
  const [resp, setResp] = useState(editing?.internal_responsible ?? "");
  const [status, setStatus] = useState(editing?.status ?? "activo");
  const [obs, setObs] = useState(editing?.observations ?? "");

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{editing ? "Editar ayuntamiento" : "Nuevo ayuntamiento"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div><Label>Nombre *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Zona</Label><Input value={zone ?? ""} onChange={(e) => setZone(e.target.value)} /></div>
          <div><Label>Responsable interno</Label><Input value={resp ?? ""} onChange={(e) => setResp(e.target.value)} /></div>
        </div>
        <div>
          <Label>Estado</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="activo">activo</SelectItem>
              <SelectItem value="inactivo">inactivo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>Observaciones</Label><Textarea value={obs ?? ""} onChange={(e) => setObs(e.target.value)} rows={3} /></div>
      </div>
      <DialogFooter>
        <Button onClick={() => onSubmit({ name, zone, internal_responsible: resp, status: status as any, observations: obs })}>
          {editing ? "Guardar cambios" : "Crear"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
