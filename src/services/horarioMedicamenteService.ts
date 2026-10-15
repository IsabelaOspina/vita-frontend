import { apiRequest } from "./api";
import { obtenerToken } from "../utils/tokenStorage";

import type { HorarioMedicamentoRequest } from "../dto/HorarioMedicamentoRequest";
import type { HorarioMedicamentoResponse } from "../dto/HorarioMedicamentoResponse";
import type { TomaMedicamentoResponse } from "../dto/TomaMedicamentoResponse";

// Horarios de un medicamento (cada cuánto se toma) y las tomas que generan.

async function obtenerTokenRequerido(): Promise<string> {
  const token = await obtenerToken();

  if (!token) {
    throw new Error("Debes iniciar sesión para realizar esta operación.");
  }

  return token;
}

// Crear un horario para un medicamento
export async function crearHorario(
  medicamentoId: number,
  horario: HorarioMedicamentoRequest
): Promise<HorarioMedicamentoResponse> {
  const token = await obtenerTokenRequerido();

  return await apiRequest<HorarioMedicamentoResponse>(
    `/api/medicamentos/${medicamentoId}/horarios`,
    "POST",
    horario,
    token
  );
}

// Horarios de un medicamento
export async function listarHorarios(
  medicamentoId: number
): Promise<HorarioMedicamentoResponse[]> {
  const token = await obtenerTokenRequerido();

  return await apiRequest<HorarioMedicamentoResponse[]>(
    `/api/medicamentos/${medicamentoId}/horarios`,
    "GET",
    undefined,
    token
  );
}

// Cancelar un horario
export async function cancelarHorario(
  medicamentoId: number,
  horarioId: number
): Promise<void> {
  const token = await obtenerTokenRequerido();

  await apiRequest<void>(
    `/api/medicamentos/${medicamentoId}/horarios/${horarioId}`,
    "DELETE",
    undefined,
    token
  );
}

// Tomas de un horario entre dos fechas (formato 2026-10-20T00:00:00)
export async function listarTomasDeHorario(
  medicamentoId: number,
  horarioId: number,
  desde: string,
  hasta: string
): Promise<TomaMedicamentoResponse[]> {
  const token = await obtenerTokenRequerido();

  return await apiRequest<TomaMedicamentoResponse[]>(
    `/api/medicamentos/${medicamentoId}/horarios/${horarioId}/tomas?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`,
    "GET",
    undefined,
    token
  );
}