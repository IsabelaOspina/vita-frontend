
import type { TipoFrecuenciaMedicamento } from "./TipoFrecuenciaMedicamento";
import type { TipoRecordatorio } from "./TipoRecordatorio";

export interface HorarioMedicamentoRequest {
  tipoFrecuencia: TipoFrecuenciaMedicamento;
  fechaHoraInicio: string;
  fechaHoraFin?: string | null;
  intervaloHoras?: number | null;
  horaProgramada?: string | null;
  diasSemana?: string[] | null;
  tipoRecordatorio: TipoRecordatorio;
}
