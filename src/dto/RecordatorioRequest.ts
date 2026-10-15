import type { TipoRecordatorio } from "../enums/TipoRecordatorio";

export interface RecordatorioRequest {
  fechaHora: string;
  mensaje: string;
  tipoRecordatorio: TipoRecordatorio;
}
