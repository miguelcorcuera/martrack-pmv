# MarTrack PMV

PMV de gestión de flota: vehículos, ayuntamientos, empleados, entregas con firma digital del supervisor, evidencias y auditoría. Roles: `root`, `gerencia`, `coordinador`, `supervisor`.

> **Backend**: Supabase externo (no Lovable Cloud). **Stack**: TanStack Start + Vite + React 19 + Tailwind v4 + shadcn/ui + Supabase JS. Service role NUNCA en el frontend — todo el admin de usuarios pasa por una Edge Function que valida el rol `root` server-side.

---

## 1. Setup en tu Supabase

### 1.1 Ejecutar el SQL inicial

Abre el SQL Editor de tu proyecto Supabase (`martrack-dev`) y ejecuta el archivo:

```
db/0001_init.sql
```

Crea: enums, tablas (`profiles`, `user_roles`, `municipalities`, `employees`, `vehicles`, `vehicle_deliveries`, `vehicle_evidence`, `delivery_signatures`, `audit_log`), índices, función `has_role()`, trigger de `updated_at`, trigger `on_auth_user_created` (auto-crea profile), políticas RLS, buckets de Storage (`vehicle-photos` público, `vehicle-documents` y `signatures` privados) con sus policies, y los **datos demo** (10 ayuntamientos, 40 empleados, 10 vehículos, 5 entregas).

Es idempotente: puedes re-ejecutarlo sin romper nada.

### 1.2 Desplegar la Edge Function `admin-users`

```bash
# Desde la raíz del proyecto, copia la función a tu repo de supabase CLI
mkdir -p supabase/functions/admin-users
cp supabase-edge-functions/admin-users/index.ts supabase/functions/admin-users/

# Login y link
supabase login
supabase link --project-ref ctpxcycqzambusjyfppn

# Configura el secret (NO va al frontend)
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<TU_SERVICE_ROLE_KEY>

# Deploy. --no-verify-jwt: la función valida JWT manualmente (necesario para el endpoint público `bootstrap`)
supabase functions deploy admin-users --no-verify-jwt
```

`SUPABASE_URL` y `SUPABASE_ANON_KEY` ya las inyecta Supabase automáticamente como secrets de la función.

### 1.3 Crear los usuarios demo

Tienes dos opciones:

- **Opción A (recomendada)**: abre `/login` en la app y pulsa **“Crear usuarios demo”**. Llama al endpoint `bootstrap` de la Edge Function, que crea/vincula los 4 usuarios:
  - `root@demo.com` / `Demo1234!` → rol `root`
  - `gerencia@demo.com` / `Demo1234!` → rol `gerencia`
  - `coordinador@demo.com` / `Demo1234!` → rol `coordinador` (vinculado a un empleado coordinador del seed)
  - `supervisor@demo.com` / `Demo1234!` → rol `supervisor` (vinculado a un empleado supervisor del seed)
- **Opción B**: créalos manualmente en Supabase → Authentication → Users e inserta filas en `public.user_roles` con su rol.

---

## 2. Variables de entorno

El cliente lee Supabase desde:

```
VITE_SUPABASE_URL=https://ctpxcycqzambusjyfppn.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

- En **Lovable**: configurarlas en **Workspace Settings → Build Secrets** (o usar el `.env` ya generado).
- En **Vercel**: añadirlas en **Project Settings → Environment Variables** para `Production`, `Preview` y `Development`. Como la `anon key` es pública por diseño, no hay riesgo si queda en el bundle.
- La `service_role key` **solo** se configura como secret de la Edge Function (`supabase secrets set ...`). **Jamás** debe ir en el frontend.

---

## 3. Ejecutar localmente

```bash
bun install
bun run dev
```

---

## 4. Despliegue en Vercel

La plantilla actual (TanStack Start con preset Cloudflare) es portable a Vercel cambiando el preset de salida. Para Fase 2:

```bash
bun add -d vercel
# Sustituir el preset cloudflare por el preset vercel en vite.config.ts (preset: "vercel")
# Conectar el repo en vercel.com, definir las VITE_* env vars y desplegar.
```

Ramas previstas:
- `dev` → Supabase `martrack-dev` (preview en Vercel)
- `staging` → Supabase `martrack-staging` (preview)
- `main` → Supabase `martrack-prod` (producción)

---

## 5. Roles y permisos efectivos

| Acción | root | gerencia | coordinador | supervisor |
|---|---|---|---|---|
| Ver dashboard | ✅ | ✅ | ✅ | ✅ |
| CRUD ayuntamientos / vehículos / empleados | ✅ | 👁️ | ✅ | 👁️ |
| Crear / editar entregas | ✅ | 👁️ | ✅ | 👁️ asignadas |
| Firmar entrega asignada | ✅ | — | — | ✅ |
| Cerrar / cancelar entrega | ✅ | — | ✅ | — |
| Subir evidencias | ✅ | — | ✅ | ✅ |
| Eliminar evidencia (soft) | ✅ | — | ✅ | — |
| Administración de accesos (crear, contraseña, bloquear) | ✅ | — | — | — |
| Ver auditoría | ✅ | ✅ | — | — |

RLS aplica todas estas reglas a nivel base de datos.

---

## 6. Flujo de entrega

1. `root`/`coordinador` crea entrega → estado `pendiente_firma`.
2. `supervisor` asignado abre la entrega, revisa datos, marca el checkbox de aceptación y firma en pantalla (`react-signature-canvas`).
3. La firma se sube a `signatures/<delivery_id>/<ts>.png`, se inserta en `delivery_signatures`, la entrega pasa a `firmado` y el vehículo actualiza `current_responsible_employee_id` y status `asignado`.
4. `root`/`coordinador` puede `cerrar` (estado final) o `cancelar` (con motivo). Todo queda en `audit_log`.

---

## 7. Estructura

```
src/
  components/        page header, app shell, status badge, ui/ (shadcn)
  hooks/             use-auth (sesión + rol)
  lib/               supabase client, types, audit helper
  routes/
    __root.tsx       providers (QueryClient, AuthProvider, Toaster)
    index.tsx        redirect según sesión
    login.tsx        login + bootstrap demo
    _authenticated.tsx        guard de rutas protegidas
    _authenticated/
      dashboard.tsx
      vehiculos.tsx
      ayuntamientos.tsx
      empleados.tsx
      accesos.tsx                  (root only) crea usuarios via Edge Function
      entregas.tsx
      entregas.$id.tsx             detalle + firma digital
      evidencias.tsx
      auditoria.tsx
      perfil.tsx
      configuracion.tsx
db/
  0001_init.sql                    esquema completo + RLS + storage + seed
supabase-edge-functions/
  admin-users/index.ts             Edge Function (bootstrap, create_user, set_password, set_active, send_reset, set_role)
```

---

## 8. Checklist Fase 1 (lo que YA funciona)

- [x] Login con Supabase Auth, sesión persistente, redirección por rol
- [x] Dashboard con tarjetas y últimas entregas/auditoría
- [x] CRUD ayuntamientos
- [x] CRUD vehículos con filtros (ayuntamiento, estado), responsable
- [x] Listado de empleados con filtros
- [x] Administración de accesos: crear empleado con acceso, cambiar contraseña, bloquear/activar (vía Edge Function, sin service_role en el cliente)
- [x] Crear entregas seleccionando supervisor (filtra por `role_operational` + `status=activo`)
- [x] Firma digital del supervisor con checkbox obligatorio + términos
- [x] Cierre / cancelación de entrega, actualización de responsable del vehículo
- [x] Auditoría visible (root/gerencia)
- [x] RLS en todas las tablas
- [x] Storage buckets + políticas

## 9. Pendiente Fase 1.5 (no decorativo, todavía sin implementar)

- [ ] Subida y galería de evidencias por vehículo y entrega (UI + soft delete con `deleted_by` + filtros que excluyan eliminadas en TODAS las vistas)
- [ ] Detalle/edición de empleado completo desde Empleados (hoy se gestionan desde Accesos + seed)
- [ ] Cambio de supervisor in-line en una entrega no cerrada (con auditoría)
- [ ] Reset de contraseña por email (`send_reset` ya existe en la Edge Function, falta UI)
- [ ] Pantalla `/reset-password` para completar el flujo de recuperación
- [ ] Pantalla de detalle de vehículo con historial de entregas, evidencias y auditoría
- [ ] Configuración (parámetros del sistema)

## 10. Seguridad

- `anon key` y `URL` van en el cliente — públicas por diseño.
- `service_role key` solo como secret de la Edge Function.
- La Edge Function valida que el JWT del caller pertenece a un usuario con rol `root` antes de cualquier operación admin.
- RLS impide cualquier acceso cruzado entre roles aunque el cliente intente bypassear.
- Eliminación de evidencias es **soft delete** por defecto. Las consultas filtran `is_deleted = false` (también vía RLS para no-root).
- No hay datos reales: todos los empleados, vehículos y matrículas son sintéticos (`...demo@martrack.local`).
