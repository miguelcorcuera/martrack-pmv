import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import { PageBody, PageHeader, StatusBadge } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase, callAdminFn } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import type { AppRole } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/accesos")({ component: AccessAdminPage });

function AccessAdminPage() {
  const qc = useQueryClient();
  const { isRoot } = useAuth();
  const [openCreate, setOpenCreate] = useState(false);
  const [openPwd, setOpenPwd] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["access-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name, email, position, access_status, status, auth_user_id, municipality_id, municipalities(name)")
        .order("full_name");
      if (error) throw error;
      const userIds = (data ?? []).map((e: any) => e.auth_user_id).filter(Boolean);
      const { data: roles } = await supabase.from("user_roles").select("user_id, role").in("user_id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
      const roleByUser = new Map<string, string>((roles ?? []).map((r: any) => [r.user_id, r.role]));
      return (data ?? []).map((e: any) => ({ ...e, role: e.auth_user_id ? roleByUser.get(e.auth_user_id) ?? null : null }));
    },
  });

  if (!isRoot) {
    return (
      <>
        <PageHeader title="Administración de accesos" description="Solo root puede gestionar accesos." />
        <PageBody><p className="text-sm text-muted-foreground">No tienes permisos para esta sección.</p></PageBody>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Administración de accesos"
        description="Crear empleado con acceso, cambiar rol, contraseña y estado de acceso."
        actions={
          <Dialog open={openCreate} onOpenChange={setOpenCreate}>
            <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" />Nuevo empleado con acceso</Button></DialogTrigger>
            <CreateUserDialog onDone={() => { setOpenCreate(false); qc.invalidateQueries({ queryKey: ["access-list"] }); }} />
          </Dialog>
        }
      />
      <PageBody>
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Cargo</th>
                <th className="px-4 py-3">Ayuntamiento</th>
                <th className="px-4 py-3">Acceso</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Cargando…</td></tr>}
              {(data ?? []).map((e: any) => (
                <tr key={e.id} className="hover:bg-accent/30">
                  <td className="px-4 py-3 font-medium">{e.full_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{e.email ?? "—"}</td>
                  <td className="px-4 py-3">{e.role ?? <span className="text-muted-foreground">sin acceso</span>}</td>
                  <td className="px-4 py-3 text-muted-foreground">{e.position ?? "—"}</td>
                  <td className="px-4 py-3">{e.municipalities?.name ?? "—"}</td>
                  <td className="px-4 py-3"><StatusBadge value={e.access_status} /></td>
                  <td className="px-4 py-3 text-right">
                    {e.auth_user_id && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => setOpenPwd(e.auth_user_id)}>Cambiar contraseña</Button>
                        <Button variant="ghost" size="sm" onClick={async () => {
                          try {
                            await callAdminFn("set_active", { user_id: e.auth_user_id, employee_id: e.id, status: e.access_status === "activo" ? "bloqueado" : "activo" });
                            toast.success("Estado actualizado"); qc.invalidateQueries({ queryKey: ["access-list"] });
                          } catch (err: any) { toast.error(err.message); }
                        }}>{e.access_status === "activo" ? "Bloquear" : "Activar"}</Button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {openPwd && <PwdDialog userId={openPwd} onClose={() => setOpenPwd(null)} />}
      </PageBody>
    </>
  );
}

function CreateUserDialog({ onDone }: { onDone: () => void }) {
  const { data: emps } = useQuery({
    queryKey: ["emps-no-access"],
    queryFn: async () => (await supabase.from("employees").select("id,full_name,email,position").is("auth_user_id", null).order("full_name")).data ?? [],
  });
  const [employee_id, setEmpId] = useState<string>("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [full_name, setFullName] = useState("");
  const [role, setRole] = useState<AppRole>("supervisor");
  const [submitting, setSubmitting] = useState(false);

  const onPickEmp = (id: string) => {
    setEmpId(id);
    const e = (emps ?? []).find((x: any) => x.id === id);
    if (e) { setEmail(e.email ?? ""); setFullName(e.full_name); }
  };

  const submit = async () => {
    if (!email || !password || password.length < 8) return toast.error("Email válido y contraseña ≥ 8 caracteres");
    if (password !== confirm) return toast.error("Las contraseñas no coinciden");
    setSubmitting(true);
    try {
      await callAdminFn("create_user", { email: email.trim(), password, full_name, role, employee_id: employee_id || null });
      toast.success("Usuario creado y vinculado");
      onDone();
    } catch (e: any) { toast.error(e.message); } finally { setSubmitting(false); }
  };

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>Crear empleado con acceso</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Vincular a empleado existente (opcional)</Label>
          <Select value={employee_id} onValueChange={onPickEmp}>
            <SelectTrigger><SelectValue placeholder="Selecciona empleado sin acceso" /></SelectTrigger>
            <SelectContent>{(emps ?? []).map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name} · {e.position ?? "—"}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Nombre completo</Label><Input value={full_name} onChange={(e) => setFullName(e.target.value)} /></div>
        <div><Label>Email de acceso *</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Contraseña inicial *</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <div><Label>Confirmar *</Label><Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
        </div>
        <div>
          <Label>Rol del sistema *</Label>
          <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(["root","gerencia","coordinador","supervisor"] as AppRole[]).map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Crear empleado y acceso
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function PwdDialog({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [pwd, setPwd] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submit = async () => {
    if (pwd.length < 8) return toast.error("Mínimo 8 caracteres");
    setSubmitting(true);
    try {
      await callAdminFn("set_password", { user_id: userId, password: pwd });
      toast.success("Contraseña actualizada"); onClose();
    } catch (e: any) { toast.error(e.message); } finally { setSubmitting(false); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Cambiar contraseña</DialogTitle></DialogHeader>
        <div><Label>Nueva contraseña</Label><Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} /></div>
        <DialogFooter><Button onClick={submit} disabled={submitting}>{submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Guardar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
