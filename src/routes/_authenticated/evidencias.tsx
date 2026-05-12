import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageBody, PageHeader } from "@/components/page";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/evidencias")({ component: EvidencePage });

function EvidencePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["evidence-list"],
    queryFn: async () => (await supabase
      .from("vehicle_evidence")
      .select("id, file_name, file_type, created_at, vehicle_id, vehicles(plate)")
      .eq("is_deleted", false)
      .order("created_at",{ascending:false})
      .limit(100)).data ?? [],
  });
  return (
    <>
      <PageHeader title="Evidencias" description="Listado global de evidencias activas (no eliminadas). Subida y galería por vehículo: Fase 1.5." />
      <PageBody>
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Vehículo</th>
                <th className="px-4 py-3">Archivo</th>
                <th className="px-4 py-3">Tipo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Cargando…</td></tr>}
              {!isLoading && (data ?? []).length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Sin evidencias todavía.</td></tr>}
              {(data ?? []).map((e: any) => (
                <tr key={e.id}>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{format(new Date(e.created_at), "yyyy-MM-dd HH:mm")}</td>
                  <td className="px-4 py-3">{e.vehicles?.plate ?? "—"}</td>
                  <td className="px-4 py-3 font-medium">{e.file_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{e.file_type ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageBody>
    </>
  );
}
