import type { TipoRecordatorio } from "../enums/TipoRecordatorio";
import type { EstadoRecordatorio } from "../enums/EstadoRecordatorio";

export interface RecordatorioResponse {
  id: number;
  fechaHora: string;
  mensaje: string;
  tipoRecordatorio: TipoRecordatorio;
  estado: EstadoRecordatorio;
  actividadSaludId: number | null;
  tomaMedicamentoId: number | null;
}
