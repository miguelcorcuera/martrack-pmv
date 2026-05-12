import { createFileRoute } from "@tanstack/react-router";
import { PageBody, PageHeader } from "@/components/page";

export const Route = createFileRoute("/_authenticated/configuracion")({ component: ConfigPage });

function ConfigPage() {
  return (
    <>
      <PageHeader title="Configuración" description="Solo root. Reservado para Fase 1.5 (parámetros del sistema, plantillas, Storage policies)." />
      <PageBody>
        <p className="text-sm text-muted-foreground">Sin parámetros configurables en esta versión.</p>
      </PageBody>
    </>
  );
}
