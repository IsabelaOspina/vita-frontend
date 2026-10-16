import type { EstadoTomaMed } from "./EstadoTomaMed";

export interface TomaMedicamentoResponse {
  id: number;
  medicamentoId: number;
  medicamentoNombre: string;
  dosis: string;
  fechaHora: string;
  estado: EstadoTomaMed;
}
