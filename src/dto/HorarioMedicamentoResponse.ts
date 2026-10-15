import type { TipoFrecuenciaMedicamento } from "../enums/TipoFrecuenciaMedicamento";
import type { TipoRecordatorio } from "../enums/TipoRecordatorio";

export interface HorarioMedicamentoResponse {
  id: number;
  medicamentoId: number;
  tipoFrecuencia: TipoFrecuenciaMedicamento;
  fechaHoraInicio: string;
  fechaHoraFin: string | null;
  intervaloHoras: number | null;
  horaProgramada: string | null;
  diasSemana: string[] | null;
  tipoRecordatorio: TipoRecordatorio;
  activo: boolean;
}
