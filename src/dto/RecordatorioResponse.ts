import type { TipoRecordatorio } from "./TipoRecordatorio";
import type { EstadoRecordatorio } from "./EstadoRecordatorio";

export interface RecordatorioResponse {
  id: number;
  fechaHora: string;
  mensaje: string;
  tipoRecordatorio: TipoRecordatorio;
  estado: EstadoRecordatorio;
  actividadSaludId: number | null;
  tomaMedicamentoId: number | null;
}
