import { apiRequest } from "./api";
import { obtenerToken } from "../utils/tokenStorage";
import type { AsignacionResponse } from "../dto/AsignacionResponse";

async function obtenerTokenRequerido(): Promise<string> {
  const token = await obtenerToken();

  if (!token) {
    throw new Error("Debes iniciar sesión para realizar esta operación.");
  }

  return token;
}

export async function asignarPaciente(
  profesionalId: number,
  pacienteId: number
): Promise<AsignacionResponse> {
  const token = await obtenerTokenRequerido();

  return await apiRequest<AsignacionResponse>(
    `/api/admin/personal-salud/${profesionalId}/pacientes/${pacienteId}`,
    "POST",
    undefined,
    token
  );
}

export async function desasignarPaciente(
  profesionalId: number,
  pacienteId: number
): Promise<void> {
  const token = await obtenerTokenRequerido();

  await apiRequest<void>(
    `/api/admin/personal-salud/${profesionalId}/pacientes/${pacienteId}`,
    "DELETE",
    undefined,
    token
  );
}

export async function consultarPacientesDeProfesional(
  profesionalId: number
): Promise<AsignacionResponse[]> {
  const token = await obtenerTokenRequerido();

  return await apiRequest<AsignacionResponse[]>(
    `/api/admin/personal-salud/${profesionalId}/pacientes`,
    "GET",
    undefined,
    token
  );
}

export async function consultarProfesionalesDePaciente(
  pacienteId: number
): Promise<AsignacionResponse[]> {
  const token = await obtenerTokenRequerido();

  return await apiRequest<AsignacionResponse[]>(
    `/api/admin/pacientes/${pacienteId}/personal-salud`,
    "GET",
    undefined,
    token
  );
}
