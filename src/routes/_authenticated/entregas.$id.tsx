import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { PageBody, PageHeader, StatusBadge, statusTone } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { logAudit } from "@/lib/audit";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/entregas/$id")({ component: DeliveryDetailPage });

const TERMS = "Declaro haber revisado el vehículo asignado, junto con las evidencias adjuntas, y acepto la entrega en el estado registrado. A partir de esta entrega, quedo identificado como responsable operativo del recurso según las condiciones internas establecidas.";

function DeliveryDetailPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user, role, isRoot, isCoordinator } = useAuth();
  const sigRef = useRef<SignatureCanvas | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { data: delivery, isLoading } = useQuery({
    queryKey: ["delivery", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_deliveries")
        .select("*, vehicles(plate,brand,model), municipalities(name), supervisor:supervisor_employee_id(id,full_name,auth_user_id), receiver:receiver_employee_id(id,full_name)")
        .eq("id", id).single();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: signature } = useQuery({
    queryKey: ["signature", id],
    queryFn: async () => (await supabase.from("delivery_signatures").select("*").eq("delivery_id", id).maybeSingle()).data,
  });

  const isAssignedSupervisor = !!delivery && delivery.supervisor?.auth_user_id === user?.id;
  const canSign = isAssignedSupervisor && !signature && !["signed","closed","cancelled"].includes(delivery?.delivery_status);
  const canClose = (isRoot || isCoordinator) && delivery?.delivery_status === "signed";

  const onSign = async () => {
    if (!sigRef.current || sigRef.current.isEmpty()) return toast.error("Firma vacía");
    if (!accepted) return toast.error("Debes aceptar los términos");
    setSubmitting(true);
    try {
      const dataUrl = sigRef.current.toDataURL("image/png");
      const blob = await (await fetch(dataUrl)).blob();
      const path = `${id}/${Date.now()}.png`;
      const up = await supabase.storage.from("signatures").upload(path, blob, { contentType: "image/png", upsert: false });
      if (up.error) throw up.error;
      const { error: sigErr } = await supabase.from("delivery_signatures").insert({
        delivery_id: id,
        signer_employee_id: delivery.supervisor?.id ?? null,
        signer_user_id: user?.id ?? null,
        signature_storage_path: path,
        accepted_terms: true,
        user_agent: navigator.userAgent,
      });
      if (sigErr) throw sigErr;
      const { error: updErr } = await supabase.from("vehicle_deliveries").update({
        delivery_status: "signed", signed_at: new Date().toISOString(),
      }).eq("id", id);
      if (updErr) throw updErr;
      // Actualiza responsable del vehículo
      await supabase.from("vehicles").update({
        current_responsible_employee_id: delivery.receiver_employee_id,
        status: "assigned",
      }).eq("id", delivery.vehicle_id);
      await logAudit({ entity_type: "delivery", entity_id: id, action: "firma_registrada", actor_role: role, description: "Firma registrada por supervisor" });
      toast.success("Entrega firmada");
      qc.invalidateQueries();
    } catch (e: any) {
      toast.error(e.message ?? "Error al firmar");
    } finally { setSubmitting(false); }
  };

  const onClose = async () => {
    const { error } = await supabase.from("vehicle_deliveries").update({ delivery_status: "closed", closed_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    await logAudit({ entity_type: "delivery", entity_id: id, action: "entrega_cerrada", actor_role: role });
    toast.success("Entrega cerrada");
    qc.invalidateQueries();
  };

  const onCancel = async () => {
    const reason = prompt("Motivo de cancelación:");
    if (!reason) return;
    const { error } = await supabase.from("vehicle_deliveries").update({
      delivery_status: "cancelled", cancelled_at: new Date().toISOString(), cancelled_reason: reason,
    }).eq("id", id);
    if (error) return toast.error(error.message);
    await logAudit({ entity_type: "delivery", entity_id: id, action: "entrega_cancelada", actor_role: role, description: reason });
    toast.success("Entrega cancelada");
    qc.invalidateQueries();
  };

  if (isLoading || !delivery) {
    return <PageBody><p className="text-sm text-muted-foreground">Cargando…</p></PageBody>;
  }

  return (
    <>
      <PageHeader
        title={`Entrega · ${delivery.vehicles?.plate}`}
        description={`${delivery.vehicles?.brand} ${delivery.vehicles?.model} · ${delivery.municipalities?.name ?? "—"}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge value={delivery.delivery_status} tone={statusTone(delivery.delivery_status)} />
            <Button asChild variant="outline" size="sm"><Link to="/entregas"><ArrowLeft className="mr-1 h-4 w-4" />Volver</Link></Button>
          </div>
        }
      />
      <PageBody>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-lg border border-border bg-card p-5">
              <h3 className="mb-4 text-sm font-medium">Datos</h3>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div><dt className="text-xs uppercase tracking-wider text-muted-foreground">Fecha</dt><dd>{format(new Date(delivery.delivery_date), "yyyy-MM-dd")}</dd></div>
                <div><dt className="text-xs uppercase tracking-wider text-muted-foreground">Supervisor</dt><dd>{delivery.supervisor?.full_name ?? "—"}</dd></div>
                <div><dt className="text-xs uppercase tracking-wider text-muted-foreground">Receptor</dt><dd>{delivery.receiver?.full_name ?? "—"}</dd></div>
                <div><dt className="text-xs uppercase tracking-wider text-muted-foreground">Firmado</dt><dd>{delivery.signed_at ? format(new Date(delivery.signed_at), "yyyy-MM-dd HH:mm") : "—"}</dd></div>
                <div className="col-span-2"><dt className="text-xs uppercase tracking-wider text-muted-foreground">Observaciones</dt><dd>{delivery.observations ?? "—"}</dd></div>
              </dl>
            </div>

            <div className="rounded-lg border border-border bg-card p-5">
              <h3 className="mb-3 text-sm font-medium">Firma del supervisor</h3>
              {signature ? (
                <p className="text-sm text-success">Entrega ya firmada el {format(new Date(signature.signed_at), "yyyy-MM-dd HH:mm")}.</p>
              ) : !canSign ? (
                <p className="text-sm text-muted-foreground">
                  {isAssignedSupervisor ? "Esta entrega ya no admite firma." : "Solo el supervisor asignado puede firmar esta entrega."}
                </p>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs leading-relaxed text-muted-foreground">{TERMS}</p>
                  <div className="rounded-md border border-dashed border-border bg-background">
                    <SignatureCanvas ref={(r) => { sigRef.current = r; }} canvasProps={{ width: 600, height: 180, className: "w-full" }} penColor="#111" />
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox checked={accepted} onCheckedChange={(v) => setAccepted(!!v)} />
                      Acepto la entrega del vehículo en el estado registrado.
                    </label>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => sigRef.current?.clear()}>Borrar</Button>
                      <Button size="sm" onClick={onSign} disabled={submitting}>Firmar y guardar</Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-card p-5">
              <h3 className="mb-3 text-sm font-medium">Acciones</h3>
              <div className="flex flex-col gap-2">
                {canClose && <Button onClick={onClose}>Cerrar entrega</Button>}
                {(isRoot || isCoordinator) && delivery.delivery_status !== "closed" && delivery.delivery_status !== "cancelled" &&
                  <Button variant="outline" onClick={onCancel}>Cancelar entrega</Button>}
                <Button variant="ghost" onClick={() => navigate({ to: "/entregas" })}>Volver al listado</Button>
              </div>
            </div>
            <div className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
              Galería de evidencias y cambio de supervisor en línea: Fase 1.5.
            </div>
          </div>
        </div>
      </PageBody>
    </>
  );
}
