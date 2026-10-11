import type { TipoDiscapacidad } from "./TipoDiscapacidad";

export interface DiscapacidadRequest {
  tipo: TipoDiscapacidad;
  descripcion?: string;
}
