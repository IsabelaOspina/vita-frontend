import { apiRequest } from "./api";
import { obtenerToken } from "../utils/tokenStorage";

import type { AgrupacionTiempo } from "../dto/AgrupacionTiempo";
import type { PaginaResponse } from "../dto/PaginaResponse";
import type { SintomaActualizarRequest } from "../dto/SintomaActualizarRequest";
import type { SintomaEvolucionResponse } from "../dto/SintomaEvolucionResponse";
import type { SintomaFiltro } from "../dto/SintomaFiltro";
import type { SintomaRequest } from "../dto/SintomaRequest";
import type { SintomaResponse } from "../dto/SintomaResponse";
import type { SintomaResumenResponse } from "../dto/SintomaResumenResponse";
import type { TipoSintomaResponse } from "../dto/TipoSintomaResponse";

// Seguimiento de síntomas del paciente (rol USUARIO).
// El backend saca el id del paciente del token, por eso ninguna ruta lleva el id del usuario.
async function obtenerTokenRequerido(): Promise<string> {
    const token = await obtenerToken();

    if (!token) {
        throw new Error("Debes iniciar sesión para realizar esta operación.");
    }

    return token;
}


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

// Registrar un síntoma
export async function registrarSintoma(
    sintoma: SintomaRequest
): Promise<SintomaResponse> {
    const token = await obtenerTokenRequerido();

    return await apiRequest<SintomaResponse>(
        "/api/sintomas",
        "POST",
        sintoma,
        token
    );
}

// Historial con filtros y paginación (por defecto: más recientes, página 0, 20 por página)
export async function listarSintomas(
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
        `/api/sintomas${parametros}`,
        "GET",
        undefined,
        token
    );
}

// Consultar un síntoma
export async function obtenerSintoma(id: number): Promise<SintomaResponse> {
    const token = await obtenerTokenRequerido();

    return await apiRequest<SintomaResponse>(
        `/api/sintomas/${id}`,
        "GET",
        undefined,
        token
    );
}

// Editar un síntoma
export async function actualizarSintoma(
    id: number,
    sintoma: SintomaActualizarRequest
): Promise<SintomaResponse> {
    const token = await obtenerTokenRequerido();

    return await apiRequest<SintomaResponse>(
        `/api/sintomas/${id}`,
        "PUT",
        sintoma,
        token
    );
}

// Eliminar un síntoma
export async function eliminarSintoma(id: number): Promise<void> {
    const token = await obtenerTokenRequerido();

    await apiRequest<void>(
        `/api/sintomas/${id}`,
        "DELETE",
        undefined,
        token
    );
}

// Indicadores del periodo (por defecto, últimos 30 días). Fechas yyyy-MM-dd
export async function obtenerResumenSintomas(
    desde?: string,
    hasta?: string
): Promise<SintomaResumenResponse> {
    const token = await obtenerTokenRequerido();

    return await apiRequest<SintomaResumenResponse>(
        `/api/sintomas/resumen${construirParametros({ desde, hasta })}`,
        "GET",
        undefined,
        token
    );
}

// Evolución de la intensidad agrupada por día, semana o mes.
// Sin tipo se consultan todos los síntomas juntos
export async function obtenerEvolucionSintomas(
    tipo?: string,
    desde?: string,
    hasta?: string,
    agrupacion?: AgrupacionTiempo
): Promise<SintomaEvolucionResponse> {
    const token = await obtenerTokenRequerido();

    return await apiRequest<SintomaEvolucionResponse>(
        `/api/sintomas/evolucion${construirParametros({ tipo, desde, hasta, agrupacion })}`,
        "GET",
        undefined,
        token
    );
}

// Tipos de síntoma que el paciente ya registró (para sugerirlos)
export async function obtenerTiposSintoma(): Promise<TipoSintomaResponse[]> {
    const token = await obtenerTokenRequerido();

    return await apiRequest<TipoSintomaResponse[]>(
        "/api/sintomas/tipos",
        "GET",
        undefined,
        token
    );
}