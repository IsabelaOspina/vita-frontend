import { apiRequest } from "./api";
import { obtenerToken } from "../utils/tokenStorage";

import type { RecordatorioRequest } from "../dto/RecordatorioRequest";
import type { RecordatorioResponse } from "../dto/RecordatorioResponse";

// Recordatorios de las actividades de salud y agenda para programar las notificaciones del celular.

async function obtenerTokenRequerido(): Promise<string> {
  const token = await obtenerToken();

  if (!token) {
    throw new Error("Debes iniciar sesión para realizar esta operación.");
  }

  return token;
}

// Crear un recordatorio para una actividad
export async function crearRecordatorio(
  actividadId: number,
  recordatorio: RecordatorioRequest
): Promise<RecordatorioResponse> {
  const token = await obtenerTokenRequerido();

  return await apiRequest<RecordatorioResponse>(
    `/api/actividades-salud/${actividadId}/recordatorios`,
    "POST",
    recordatorio,
    token
  );
}

// Recordatorios de una actividad
export async function listarRecordatoriosDeActividad(
  actividadId: number
): Promise<RecordatorioResponse[]> {
  const token = await obtenerTokenRequerido();

  return await apiRequest<RecordatorioResponse[]>(
    `/api/actividades-salud/${actividadId}/recordatorios`,
    "GET",
    undefined,
    token
  );
}

// Próximos recordatorios (de actividades y de medicamentos) entre dos fechas (formato 2026-10-20T00:00:00)
export async function listarAgendaRecordatorios(
  desde: string,
  hasta: string
): Promise<RecordatorioResponse[]> {
  const token = await obtenerTokenRequerido();

  return await apiRequest<RecordatorioResponse[]>(
    `/api/recordatorios/agenda?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`,
    "GET",
    undefined,
    token
  );
}

// Cancelar un recordatorio (devuelve el recordatorio con estado CANCELADO)
export async function cancelarRecordatorio(
  id: number
): Promise<RecordatorioResponse> {
  const token = await obtenerTokenRequerido();

  return await apiRequest<RecordatorioResponse>(
    `/api/recordatorios/${id}`,
    "DELETE",
    undefined,
    token
  );
}

// Avisar que el celular ya mostró la notificación
export async function marcarRecordatorioEnviado(
  id: number
): Promise<RecordatorioResponse> {
  const token = await obtenerTokenRequerido();

  return await apiRequest<RecordatorioResponse>(
    `/api/recordatorios/${id}/enviado`,
    "PATCH",
    undefined,
    token
  );
}

// El usuario confirmó que vio el recordatorio
export async function confirmarRecordatorio(
  id: number
): Promise<RecordatorioResponse> {
  const token = await obtenerTokenRequerido();

  return await apiRequest<RecordatorioResponse>(
    `/api/recordatorios/${id}/confirmar`,
    "PATCH",
    undefined,
    token
  );
}
