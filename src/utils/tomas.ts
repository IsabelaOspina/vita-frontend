import type { HorarioMedicamentoResponse } from '@/dto/HorarioMedicamentoResponse';
import type { MedicamentoResponse } from '@/dto/MedicamentoResponse';
import type { TomaMedicamentoResponse } from '@/dto/TomaMedicamentoResponse';
import { listarHorarios, listarTomasDeHorario } from '@/services/horarioMedicamenteService';
import { listarMedicamentos } from '@/services/medicamentoService';

/**
 * El backend da las tomas horario por horario. Para "Hoy" y para el resumen hay que reunirlas:
 * medicamentos activos → sus horarios activos → las tomas de cada horario en el rango.
 */
export async function tomasEntre(
    desde: string,
    hasta: string,
): Promise<{ tomas: TomaMedicamentoResponse[]; medicamentos: MedicamentoResponse[] }> {
    const medicamentos = (await listarMedicamentos()).filter((m) => m.activo);
    const horarios = (
        await Promise.all(
            medicamentos.map(async (m) => (await listarHorarios(m.id)).filter((h) => h.activo).map((h) => ({ m, h }))),
        )
    ).flat();
    const tomas = (await Promise.all(horarios.map(({ m, h }) => listarTomasDeHorario(m.id, h.id, desde, hasta)))).flat();
    tomas.sort((a, b) => a.fechaHora.localeCompare(b.fechaHora));
    return { tomas, medicamentos };
}

/** Las tomas de un medicamento en un rango, de todos sus horarios activos. */
export async function tomasDeMedicamento(
    medicamentoId: number,
    horarios: HorarioMedicamentoResponse[],
    desde: string,
    hasta: string,
): Promise<TomaMedicamentoResponse[]> {
    const activos = horarios.filter((h) => h.activo);
    const tomas = (await Promise.all(activos.map((h) => listarTomasDeHorario(medicamentoId, h.id, desde, hasta)))).flat();
    tomas.sort((a, b) => a.fechaHora.localeCompare(b.fechaHora));
    return tomas;
}