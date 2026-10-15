import type { EstadoTomaMed } from "../enums/EstadoTomaMed";

export interface TomaMedicamentoResponse {
  id: number;
  medicamentoId: number;
  medicamentoNombre: string;
  dosis: string;
  fechaHora: string;
  estado: EstadoTomaMed;
}
