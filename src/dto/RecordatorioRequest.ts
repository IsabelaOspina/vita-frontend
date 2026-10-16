import type { TipoRecordatorio } from "./TipoRecordatorio";

export interface RecordatorioRequest {
  fechaHora: string;
  mensaje: string;
  tipoRecordatorio: TipoRecordatorio;
}
