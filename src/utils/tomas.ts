import type { HorarioMedicamentoResponse } from '@/dto/HorarioMedicamentoResponse';
import type { MedicamentoResponse } from '@/dto/MedicamentoResponse';
import type { TomaMedicamentoResponse } from '@/dto/TomaMedicamentoResponse';
import { listarHorarios, listarTomasDeHorario } from '@/services/horarioMedicamenteService';
import { ApiError } from '@/services/api';
import { listarMedicamentos } from '@/services/medicamentoService';
import { listarTomasEntre } from '@/services/TomaMedicamentoService';

/**
 * Las tomas de todos los medicamentos activos en un rango (para "Hoy" y el resumen de "Mi salud").
 * Se piden en una sola consulta al backend, al mismo tiempo que la lista de medicamentos.
 * Si el backend todavía no tiene esa consulta (versión anterior), se reúnen como antes:
 * medicamentos activos → sus horarios activos → las tomas de cada horario.
 */
export async function tomasEntre(
    desde: string,
    hasta: string,
): Promise<{ tomas: TomaMedicamentoResponse[]; medicamentos: MedicamentoResponse[] }> {
    const [todos, deUnaVez] = await Promise.all([
        listarMedicamentos(),
        listarTomasEntre(desde, hasta).catch((e: unknown) => {
            // Un backend anterior responde 404/405 (o 401/403 desde su página de error); si la sesión
            // de verdad venció, la forma anterior también lo dirá
            if (e instanceof ApiError && [401, 403, 404, 405].includes(e.status)) return null;
            throw e;
        }),
    ]);
    const medicamentos = todos.filter((m) => m.activo);
    if (deUnaVez) {
        const tomas = [...deUnaVez].sort((a, b) => a.fechaHora.localeCompare(b.fechaHora));
        return { tomas, medicamentos };
    }
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