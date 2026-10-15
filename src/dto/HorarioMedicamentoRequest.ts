
import type { TipoFrecuenciaMedicamento } from "../enums/TipoFrecuenciaMedicamento";
import type { TipoRecordatorio } from "../enums/TipoRecordatorio";

export interface HorarioMedicamentoRequest {
  tipoFrecuencia: TipoFrecuenciaMedicamento;
  fechaHoraInicio: string;
  fechaHoraFin?: string | null;
  intervaloHoras?: number | null;
  horaProgramada?: string | null;
  diasSemana?: string[] | null;
  tipoRecordatorio: TipoRecordatorio;
}
