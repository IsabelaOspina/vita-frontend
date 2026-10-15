import { apiRequest } from "./api";
import { obtenerToken } from "../utils/tokenStorage";

import type { TomaMedicamentoResponse } from "../dto/TomaMedicamentoResponse";

// Cambios de estado de una toma de medicamento.

async function obtenerTokenRequerido(): Promise<string> {
  const token = await obtenerToken();

  if (!token) {
    throw new Error("Debes iniciar sesión para realizar esta operación.");
  }

  return token;
}

// Avisar que el celular ya mostró la notificación de la toma
export async function marcarTomaNotificada(
  id: number
): Promise<TomaMedicamentoResponse> {
  const token = await obtenerTokenRequerido();

  return await apiRequest<TomaMedicamentoResponse>(
    `/api/tomas-medicamento/${id}/notificado`,
    "PATCH",
    undefined,
    token
  );
}

// El usuario confirmó que se tomó el medicamento
export async function marcarTomaTomada(
  id: number
): Promise<TomaMedicamentoResponse> {
  const token = await obtenerTokenRequerido();

  return await apiRequest<TomaMedicamentoResponse>(
    `/api/tomas-medicamento/${id}/tomado`,
    "PATCH",
    undefined,
    token
  );
}