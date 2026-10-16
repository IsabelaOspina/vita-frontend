import { apiRequest } from "./api";
import { obtenerToken } from "../utils/tokenStorage";

import type { CantidadResponse } from "../dto/CantidadResponse";
import type { PaginaResponse } from "../dto/PaginaResponse";
import type { RecomendacionRequest } from "../dto/RecomendacionRequest";
import type { RecomendacionResponse } from "../dto/RecomendacionResponse";

// Recomendaciones que el personal de salud deja a sus pacientes asignados.

async function obtenerTokenRequerido(): Promise<string> {
  const token = await obtenerToken();

  if (!token) {
    throw new Error("Debes iniciar sesión para realizar esta operación.");
  }

  return token;
}

// ----- Paciente (rol USUARIO) -----

// Recomendaciones que me dejaron (las más recientes primero). soloNoLeidas=true para ver solo las nuevas
export async function listarMisRecomendaciones(
  soloNoLeidas: boolean = false,
  pagina: number = 0,
  tamano: number = 20
): Promise<PaginaResponse<RecomendacionResponse>> {
  const token = await obtenerTokenRequerido();

  return await apiRequest<PaginaResponse<RecomendacionResponse>>(
    `/api/recomendaciones?soloNoLeidas=${soloNoLeidas}&pagina=${pagina}&tamano=${tamano}`,
    "GET",
    undefined,
    token
  );
}

// Cuántas recomendaciones nuevas tengo (para mostrar un aviso en la app)
export async function contarRecomendacionesNoLeidas(): Promise<CantidadResponse> {
  const token = await obtenerTokenRequerido();

  return await apiRequest<CantidadResponse>(
    "/api/recomendaciones/no-leidas/cantidad",
    "GET",
    undefined,
    token
  );
}

// Marcar una recomendación como leída
export async function marcarRecomendacionLeida(
  id: number
): Promise<RecomendacionResponse> {
  const token = await obtenerTokenRequerido();

  return await apiRequest<RecomendacionResponse>(
    `/api/recomendaciones/${id}/leida`,
    "PATCH",
    undefined,
    token
  );
}

// ----- Personal de salud (rol PERSONAL_SALUD) -----

// Dejar una recomendación a un paciente asignado (sintomaId es opcional)
export async function crearRecomendacion(
  pacienteId: number,
  recomendacion: RecomendacionRequest
): Promise<RecomendacionResponse> {
  const token = await obtenerTokenRequerido();

  return await apiRequest<RecomendacionResponse>(
    `/api/personal-salud/pacientes/${pacienteId}/recomendaciones`,
    "POST",
    recomendacion,
    token
  );
}

// Lo que este profesional le ha escrito a ese paciente
export async function listarRecomendacionesDePaciente(
  pacienteId: number,
  pagina: number = 0,
  tamano: number = 20
): Promise<PaginaResponse<RecomendacionResponse>> {
  const token = await obtenerTokenRequerido();

  return await apiRequest<PaginaResponse<RecomendacionResponse>>(
    `/api/personal-salud/pacientes/${pacienteId}/recomendaciones?pagina=${pagina}&tamano=${tamano}`,
    "GET",
    undefined,
    token
  );
}
