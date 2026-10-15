
import type { TipoActividad } from "../enums/TipoActividad";

export interface ActividadSaludRequest {
  nombre: string;
  tipo: TipoActividad;
  fechaHora: string;
  ubicacion?: string | null;
  descripcion?: string | null;
}
