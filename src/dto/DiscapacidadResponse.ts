
import type { TipoDiscapacidad } from "./TipoDiscapacidad";

export interface DiscapacidadResponse {
  id: number;
  tipo: TipoDiscapacidad;
  descripcion: string | null;
}
