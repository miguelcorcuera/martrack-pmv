export type AppRole = "root" | "gerencia" | "coordinador" | "supervisor";
export type EmployeeStatus = "activo" | "pendiente" | "inactivo" | "bloqueado";
export type AccessStatus = "activo" | "bloqueado" | "inactivo" | "sin_acceso";
export type OperationalRole =
  | "coordinador" | "supervisor" | "conductor"
  | "operario" | "administrativo" | "responsable_flota";
export type VehicleStatus = "disponible" | "asignado" | "mantenimiento" | "baja" | "revision";
export type FuelType = "gasolina" | "diesel" | "hibrido" | "electrico" | "glp";
export type DeliveryStatus =
  | "borrador" | "evidencias_pendientes" | "pendiente_supervisor"
  | "pendiente_firma" | "firmado" | "cerrado" | "cancelado";

export interface Municipality {
  id: string; name: string; zone: string | null;
  internal_responsible: string | null;
  status: "active" | "inactive";
  observations: string | null;
  created_at: string; updated_at: string;
}

export interface Employee {
  id: string; employee_code: string;
  first_name: string; last_name: string; full_name: string;
  dni_nie_fake: string | null; email: string | null; phone: string | null;
  birth_year: number | null; hire_date: string | null;
  department: string | null; position: string | null;
  role_operational: OperationalRole | null;
  municipality_id: string | null;
  status: EmployeeStatus;
  driving_license_type: string | null;
  driving_license_expiry: string | null;
  can_drive: boolean;
  auth_user_id: string | null;
  access_status: AccessStatus;
  observations: string | null;
  created_at: string; updated_at: string;
}

export interface Vehicle {
  id: string; plate: string; brand: string; model: string;
  year: number | null; registration_date: string | null;
  color: string | null; engine: string | null;
  fuel: FuelType; mileage: number;
  municipality_id: string | null;
  status: VehicleStatus;
  current_responsible_employee_id: string | null;
  observations: string | null; is_active: boolean;
  created_at: string; updated_at: string;
}

export interface Delivery {
  id: string; vehicle_id: string;
  municipality_id: string | null;
  coordinator_user_id: string | null;
  supervisor_employee_id: string | null;
  recipient_employee_id: string | null;
  delivery_date: string;
  observations: string | null;
  status: DeliveryStatus;
  signed_at: string | null;
  closed_at: string | null;
  cancelled_at: string | null;
  cancelled_reason: string | null;
  created_at: string; updated_at: string;
}

export interface Evidence {
  id: string; vehicle_id: string; delivery_id: string | null;
  uploaded_by_user_id: string | null;
  file_name: string; file_type: string | null; file_size: number | null;
  storage_bucket: string; storage_path: string;
  description: string | null;
  is_deleted: boolean;
  created_at: string;
}

export interface AuditEvent {
  id: string; actor_user_id: string | null; actor_role: AppRole | null;
  entity_type: string; entity_id: string | null;
  action: string; description: string | null;
  previous_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
}
