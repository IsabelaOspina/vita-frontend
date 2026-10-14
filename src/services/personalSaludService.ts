import { apiRequest } from "./api";
import { obtenerToken } from "../utils/tokenStorage";

import type { AgrupacionTiempo } from "../dto/AgrupacionTiempo";
import type { AsignacionResponse } from "../dto/AsignacionResponse";
import type { PaginaResponse } from "../dto/PaginaResponse";
import type { SintomaEvolucionResponse } from "../dto/SintomaEvolucionResponse";
import type { SintomaFiltro } from "../dto/SintomaFiltro";
import type { SintomaResponse } from "../dto/SintomaResponse";
import type { SintomaResumenResponse } from "../dto/SintomaResumenResponse";

async function obtenerTokenRequerido(): Promise<string> {
  const token = await obtenerToken();

  if (!token) {
    throw new Error("Debes iniciar sesión para realizar esta operación.");
  }

  return token;
}

// Arma "?desde=...&tipo=..." solo con los valores que vienen definidos
function construirParametros(
    parametros: Record<string, string | number | undefined>
): string {
  const partes: string[] = [];

  for (const [clave, valor] of Object.entries(parametros)) {
    if (valor !== undefined && valor !== "") {
      partes.push(`${clave}=${encodeURIComponent(String(valor))}`);
    }
  }

  return partes.length > 0 ? `?${partes.join("&")}` : "";
}

export async function consultarMisPacientes(): Promise<AsignacionResponse[]> {
  const token = await obtenerToken();

  if (!token) {
    throw new Error("Debes iniciar sesión para consultar tus pacientes.");
  }

  return await apiRequest<AsignacionResponse[]>(
      "/api/personal-salud/me/pacientes",
      "GET",
      undefined,
      token
  );
}

// ---------- Síntomas de un paciente asignado (solo consulta) ----------
// Si el paciente no está asignado al profesional, el backend responde 403

// Historial del paciente con filtros y paginación
export async function consultarSintomasPaciente(
    pacienteId: number,
    filtro: SintomaFiltro = {}
): Promise<PaginaResponse<SintomaResponse>> {
  const token = await obtenerTokenRequerido();

  const parametros = construirParametros({
    desde: filtro.desde,
    hasta: filtro.hasta,
    tipo: filtro.tipo,
    intensidadMin: filtro.intensidadMin,
    intensidadMax: filtro.intensidadMax,
    orden: filtro.orden,
    pagina: filtro.pagina,
    tamano: filtro.tamano,
  });

  return await apiRequest<PaginaResponse<SintomaResponse>>(
      `/api/personal-salud/pacientes/${pacienteId}/sintomas${parametros}`,
      "GET",
      undefined,
      token
  );
}

// Un síntoma del paciente
export async function consultarSintomaPaciente(
    pacienteId: number,
    sintomaId: number
): Promise<SintomaResponse> {
  const token = await obtenerTokenRequerido();

  return await apiRequest<SintomaResponse>(
      `/api/personal-salud/pacientes/${pacienteId}/sintomas/${sintomaId}`,
      "GET",
      undefined,
      token
  );
}

// Indicadores del periodo del paciente (por defecto, últimos 30 días)
export async function consultarResumenSintomasPaciente(
    pacienteId: number,
    desde?: string,
    hasta?: string
): Promise<SintomaResumenResponse> {
  const token = await obtenerTokenRequerido();

  return await apiRequest<SintomaResumenResponse>(
      `/api/personal-salud/pacientes/${pacienteId}/sintomas/resumen${construirParametros({ desde, hasta })}`,
      "GET",
      undefined,
      token
  );
}

// Evolución de los síntomas del paciente por día, semana o mes
export async function consultarEvolucionSintomasPaciente(
    pacienteId: number,
    tipo?: string,
    desde?: string,
    hasta?: string,
    agrupacion?: AgrupacionTiempo
): Promise<SintomaEvolucionResponse> {
  const token = await obtenerTokenRequerido();

  return await apiRequest<SintomaEvolucionResponse>(
      `/api/personal-salud/pacientes/${pacienteId}/sintomas/evolucion${construirParametros({ tipo, desde, hasta, agrupacion })}`,
      "GET",
      undefined,
      token
  );
}