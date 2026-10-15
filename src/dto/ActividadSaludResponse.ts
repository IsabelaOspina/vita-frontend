
import type { TipoActividad } from "../enums/TipoActividad";
import type { EstadoActividad } from "../enums/EstadoActividad";

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
