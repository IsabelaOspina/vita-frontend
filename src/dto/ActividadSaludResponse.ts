
import type { TipoActividad } from "./TipoActividad";
import type { EstadoActividad } from "./EstadoActividad";

export interface ActividadSaludResponse {
  id: number;
  nombre: string;
  tipo: TipoActividad;
  fechaHora: string;
  ubicacion: string | null;
  descripcion: string | null;
  estado: EstadoActividad;
  fechaHoraCumplimiento: string | null;
}
