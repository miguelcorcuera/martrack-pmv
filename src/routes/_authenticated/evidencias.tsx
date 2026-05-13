import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { PageBody, PageHeader } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/evidencias")({ component: EvidencePage });

function EvidencePage() {
  const qc = useQueryClient();
  const { isRoot, isCoordinator } = useAuth();
  const canDelete = isRoot || isCoordinator;
  const [confirmDel, setConfirmDel] = useState<{ id: string; name: string } | null>(null);
  const [reason, setReason] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["evidence-active"],
    queryFn: async () => (await supabase
      .from("v_active_vehicle_evidence")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200)).data ?? [],
  });

  const submitDelete = async () => {
    if (!confirmDel) return;
    if (!reason.trim()) return toast.error("Indica un motivo");
    const { error } = await supabase.rpc("soft_delete_evidence", { evidence_id: confirmDel.id, reason: reason.trim() });
    if (error) return toast.error(error.message);
    toast.success("Evidencia eliminada");
    setConfirmDel(null); setReason("");
    qc.invalidateQueries({ queryKey: ["evidence-active"] });
  };

  return (
    <>
      <PageHeader title="Evidencias" description="Listado global de evidencias activas." />
      <PageBody>
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Archivo</th>
                <th className="px-4 py-3">Vehículo</th>
                <th className="px-4 py-3">Entrega</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Descripción</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Cargando…</td></tr>}
              {!isLoading && (data ?? []).length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Sin evidencias activas.</td></tr>}
              {(data ?? []).map((e: any) => (
                <tr key={e.id}>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{e.created_at ? format(new Date(e.created_at), "yyyy-MM-dd HH:mm") : "—"}</td>
                  <td className="px-4 py-3 font-medium">{e.file_name ?? "—"}</td>
                  <td className="px-4 py-3">{e.license_plate ?? e.vehicle_id ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{e.delivery_id ? <code className="text-[11px]">{String(e.delivery_id).slice(0, 8)}</code> : "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{e.file_type ?? e.evidence_type ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{e.description ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    {canDelete && (
                      <Button variant="ghost" size="sm" onClick={() => setConfirmDel({ id: e.id, name: e.file_name ?? "" })}>
                        <Trash2 className="mr-1 h-4 w-4" />Eliminar
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageBody>

      {confirmDel && (
        <Dialog open onOpenChange={(o) => { if (!o) { setConfirmDel(null); setReason(""); } }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Eliminar evidencia</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">{confirmDel.name}</p>
            <div><Label>Motivo *</Label><Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
            <DialogFooter><Button variant="destructive" onClick={submitDelete}>Confirmar eliminación</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
