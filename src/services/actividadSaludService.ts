import { apiRequest } from "./api";
import { obtenerToken } from "../utils/tokenStorage";

import type { ActividadSaludRequest } from "../dto/ActividadSaludRequest";
import type { ActividadSaludResponse } from "../dto/ActividadSaludResponse";

// Calendario de actividades de salud (citas médicas, terapias…) del usuario que inició sesión.
// El backend saca el usuario del token, por eso ninguna ruta lleva su id.

async function obtenerTokenRequerido(): Promise<string> {
  const token = await obtenerToken();

  if (!token) {
    throw new Error("Debes iniciar sesión para realizar esta operación.");
  }

  return token;
}

// Crear una actividad
export async function crearActividad(
  actividad: ActividadSaludRequest
): Promise<ActividadSaludResponse> {
  const token = await obtenerTokenRequerido();

  return await apiRequest<ActividadSaludResponse>(
    "/api/actividades-salud",
    "POST",
    actividad,
    token
  );
}

// Listar todas las actividades
export async function listarActividades(): Promise<ActividadSaludResponse[]> {
  const token = await obtenerTokenRequerido();

  return await apiRequest<ActividadSaludResponse[]>(
    "/api/actividades-salud",
    "GET",
    undefined,
    token
  );
}

// Actividades entre dos fechas, ambas incluidas (formato 2026-10-20T00:00:00)
export async function listarActividadesPorRango(
  desde: string,
  hasta: string
): Promise<ActividadSaludResponse[]> {
  const token = await obtenerTokenRequerido();

  return await apiRequest<ActividadSaludResponse[]>(
    `/api/actividades-salud/rango?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`,
    "GET",
    undefined,
    token
  );
}

// Actividades de un día (fecha con formato 2026-10-20)
export async function listarActividadesPorDia(
  fecha: string
): Promise<ActividadSaludResponse[]> {
  const token = await obtenerTokenRequerido();

  return await apiRequest<ActividadSaludResponse[]>(
    `/api/actividades-salud/dia?fecha=${encodeURIComponent(fecha)}`,
    "GET",
    undefined,
    token
  );
}

// Actividades de la semana (lunes a domingo) que contiene la fecha (formato 2026-10-20)
export async function listarActividadesPorSemana(
  fecha: string
): Promise<ActividadSaludResponse[]> {
  const token = await obtenerTokenRequerido();

  return await apiRequest<ActividadSaludResponse[]>(
    `/api/actividades-salud/semana?fecha=${encodeURIComponent(fecha)}`,
    "GET",
    undefined,
    token
  );
}

// Actividades de un mes (mes de 1 a 12)
export async function listarActividadesPorMes(
  anio: number,
  mes: number
): Promise<ActividadSaludResponse[]> {
  const token = await obtenerTokenRequerido();

  return await apiRequest<ActividadSaludResponse[]>(
    `/api/actividades-salud/mes?anio=${anio}&mes=${mes}`,
    "GET",
    undefined,
    token
  );
}

// Consultar una actividad
export async function obtenerActividad(
  id: number
): Promise<ActividadSaludResponse> {
  const token = await obtenerTokenRequerido();

  return await apiRequest<ActividadSaludResponse>(
    `/api/actividades-salud/${id}`,
    "GET",
    undefined,
    token
  );
}

// Editar una actividad
export async function actualizarActividad(
  id: number,
  actividad: ActividadSaludRequest
): Promise<ActividadSaludResponse> {
  const token = await obtenerTokenRequerido();

  return await apiRequest<ActividadSaludResponse>(
    `/api/actividades-salud/${id}`,
    "PUT",
    actividad,
    token
  );
}

// Marcar una actividad como realizada
export async function completarActividad(
  id: number
): Promise<ActividadSaludResponse> {
  const token = await obtenerTokenRequerido();

  return await apiRequest<ActividadSaludResponse>(
    `/api/actividades-salud/${id}/completar`,
    "PATCH",
    undefined,
    token
  );
}

// Cancelar una actividad (el backend la conserva con estado CANCELADA)
export async function cancelarActividad(id: number): Promise<void> {
  const token = await obtenerTokenRequerido();

  await apiRequest<void>(
    `/api/actividades-salud/${id}`,
    "DELETE",
    undefined,
    token
  );
}