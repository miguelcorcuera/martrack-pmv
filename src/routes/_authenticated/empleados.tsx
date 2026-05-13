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
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { logAudit } from "@/lib/audit";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/empleados")({ component: EmployeesPage });

const STATUSES = ["active", "inactive", "pending", "blocked"] as const;
const ROLES_OP = ["coordinator", "supervisor", "driver", "operator", "administrative", "fleet_manager"] as const;

interface EmployeeForm {
  id?: string;
  employee_code?: string;
  first_name?: string;
  last_name?: string;
  dni_nie_fake?: string | null;
  email?: string | null;
  phone?: string | null;
  birth_year?: number | null;
  age?: number | null;
  hire_date?: string | null;
  department?: string | null;
  position?: string | null;
  role_operational?: string | null;
  municipality_id?: string | null;
  status?: string;
  driving_license_type?: string | null;
  driving_license_expiry?: string | null;
  can_drive?: boolean;
  notes?: string | null;
}

function EmployeesPage() {
  const qc = useQueryClient();
  const { isRoot, isCoordinator, role } = useAuth();
  const canEdit = isRoot || isCoordinator;
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editing, setEditing] = useState<EmployeeForm | null>(null);
  const [open, setOpen] = useState(false);

  const { data: munis } = useQuery({
    queryKey: ["munis-lite"],
    queryFn: async () => (await supabase.from("municipalities").select("id,name").order("name")).data ?? [],
  });

  const { data, isLoading } = useQuery({
    queryKey: ["employees-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*, municipalities(name)")
        .order("last_name");
      if (error) throw error;
      return data as any[];
    },
  });

  const filtered = (data ?? []).filter((e: any) => {
    if (roleFilter !== "all" && e.role_operational !== roleFilter) return false;
    if (statusFilter !== "all" && e.status !== statusFilter) return false;
    if (!search) return true;
    return [e.full_name, e.first_name, e.last_name, e.email, e.employee_code].join(" ").toLowerCase().includes(search.toLowerCase());
  });

  const onSubmit = async (form: EmployeeForm) => {
    if (!form.first_name?.trim() || !form.last_name?.trim() || !form.employee_code?.trim()) {
      toast.error("Código, nombre y apellidos son obligatorios"); return;
    }
    const payload: Record<string, unknown> = {
      employee_code: form.employee_code.trim(),
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      dni_nie_fake: form.dni_nie_fake ?? null,
      email: form.email ?? null,
      phone: form.phone ?? null,
      birth_year: form.birth_year ?? null,
      age: form.age ?? null,
      hire_date: form.hire_date || null,
      department: form.department ?? null,
      position: form.position ?? null,
      role_operational: form.role_operational ?? null,
      municipality_id: form.municipality_id || null,
      status: form.status ?? "active",
      driving_license_type: form.driving_license_type ?? null,
      driving_license_expiry: form.driving_license_expiry || null,
      can_drive: form.can_drive ?? false,
      notes: form.notes ?? null,
    };
    if (editing?.id) {
      const { error } = await supabase.from("employees").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      await logAudit({ entity_type: "employee", entity_id: editing.id, action: "empleado_actualizado", actor_role: role, new_value: payload });
      toast.success("Empleado actualizado");
    } else {
      const { data, error } = await supabase.from("employees").insert(payload).select().single();
      if (error) return toast.error(error.message);
      await logAudit({ entity_type: "employee", entity_id: data.id, action: "empleado_creado", actor_role: role, new_value: payload });
      toast.success("Empleado creado");
    }
    setEditing(null); setOpen(false);
    qc.invalidateQueries({ queryKey: ["employees-list"] });
  };

  return (
    <>
      <PageHeader
        title="Empleados"
        description="Gestión de empleados de los ayuntamientos."
        actions={canEdit && (
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditing(null)}><Plus className="mr-1 h-4 w-4" />Nuevo empleado</Button>
            </DialogTrigger>
            <EmployeeDialog editing={editing} munis={munis ?? []} onSubmit={onSubmit} />
          </Dialog>
        )}
      />
      <PageBody>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Input placeholder="Buscar nombre, email, código…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Perfil operativo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los perfiles</SelectItem>
              {ROLES_OP.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
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
                <th className="px-4 py-3">Teléfono</th>
                <th className="px-4 py-3">Ayuntamiento</th>
                <th className="px-4 py-3">Cargo</th>
                <th className="px-4 py-3">Perfil</th>
                <th className="px-4 py-3">Conduce</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && <tr><td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">Cargando…</td></tr>}
              {!isLoading && filtered.length === 0 && <tr><td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">Sin resultados.</td></tr>}
              {filtered.map((e: any) => (
                <tr key={e.id} className="hover:bg-accent/30">
                  <td className="px-4 py-3 font-mono text-xs">{e.employee_code}</td>
                  <td className="px-4 py-3 font-medium">{e.full_name ?? `${e.first_name} ${e.last_name}`}</td>
                  <td className="px-4 py-3 text-muted-foreground">{e.email ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{e.phone ?? "—"}</td>
                  <td className="px-4 py-3">{e.municipalities?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{e.position ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{e.role_operational ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{e.can_drive ? "Sí" : "No"}</td>
                  <td className="px-4 py-3"><StatusBadge value={e.status} tone={statusTone(e.status)} /></td>
                  <td className="px-4 py-3 text-right">
                    {canEdit && <Button variant="ghost" size="sm" onClick={() => { setEditing(e as EmployeeForm); setOpen(true); }}>Editar</Button>}
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

function EmployeeDialog({ editing, munis, onSubmit }: {
  editing: EmployeeForm | null;
  munis: any[];
  onSubmit: (f: EmployeeForm) => void;
}) {
  const [f, setF] = useState<EmployeeForm>(editing ?? { status: "active", can_drive: false });
  const set = <K extends keyof EmployeeForm>(k: K, v: EmployeeForm[K]) => setF((p) => ({ ...p, [k]: v }));
  return (
    <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{editing?.id ? "Editar empleado" : "Nuevo empleado"}</DialogTitle></DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Código *</Label><Input value={f.employee_code ?? ""} onChange={(e) => set("employee_code", e.target.value)} /></div>
        <div><Label>DNI/NIE</Label><Input value={f.dni_nie_fake ?? ""} onChange={(e) => set("dni_nie_fake", e.target.value)} /></div>
        <div><Label>Nombre *</Label><Input value={f.first_name ?? ""} onChange={(e) => set("first_name", e.target.value)} /></div>
        <div><Label>Apellidos *</Label><Input value={f.last_name ?? ""} onChange={(e) => set("last_name", e.target.value)} /></div>
        <div><Label>Email</Label><Input type="email" value={f.email ?? ""} onChange={(e) => set("email", e.target.value)} /></div>
        <div><Label>Teléfono</Label><Input value={f.phone ?? ""} onChange={(e) => set("phone", e.target.value)} /></div>
        <div><Label>Año nacimiento</Label><Input type="number" value={f.birth_year ?? ""} onChange={(e) => set("birth_year", Number(e.target.value) || null)} /></div>
        <div><Label>Edad</Label><Input type="number" value={f.age ?? ""} onChange={(e) => set("age", Number(e.target.value) || null)} /></div>
        <div><Label>Fecha alta</Label><Input type="date" value={f.hire_date ?? ""} onChange={(e) => set("hire_date", e.target.value)} /></div>
        <div><Label>Departamento</Label><Input value={f.department ?? ""} onChange={(e) => set("department", e.target.value)} /></div>
        <div><Label>Cargo</Label><Input value={f.position ?? ""} onChange={(e) => set("position", e.target.value)} /></div>
        <div>
          <Label>Perfil operativo</Label>
          <Select value={f.role_operational ?? ""} onValueChange={(v) => set("role_operational", v)}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{ROLES_OP.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
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
          <Label>Estado</Label>
          <Select value={f.status ?? "active"} onValueChange={(v) => set("status", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Tipo carnet</Label><Input value={f.driving_license_type ?? ""} onChange={(e) => set("driving_license_type", e.target.value)} /></div>
        <div><Label>Caducidad carnet</Label><Input type="date" value={f.driving_license_expiry ?? ""} onChange={(e) => set("driving_license_expiry", e.target.value)} /></div>
        <div className="col-span-2 flex items-center gap-2">
          <Checkbox checked={!!f.can_drive} onCheckedChange={(v) => set("can_drive", !!v)} id="cd" />
          <Label htmlFor="cd" className="cursor-pointer">Puede conducir</Label>
        </div>
        <div className="col-span-2"><Label>Notas</Label><Textarea rows={3} value={f.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></div>
      </div>
      <DialogFooter><Button onClick={() => onSubmit(f)}>{editing?.id ? "Guardar cambios" : "Crear"}</Button></DialogFooter>
    </DialogContent>
  );
}
