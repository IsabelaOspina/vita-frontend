import { ApiError, apiRequest } from "./api";
import { obtenerToken } from "../utils/tokenStorage";

import type { ContactoEmergenciaRequest } from "../dto/ContactoEmergenciaRequest";
import type { ContactoEmergenciaResponse } from "../dto/ContactoEmergenciaResponse";
import type { SolicitudEmergenciaRequest } from "../dto/SolicitudEmergenciaRequest";
import type { SolicitudEmergenciaResponse } from "../dto/SolicitudEmergenciaResponse";

// Asistencia de emergencia (solo pacientes): el contacto de emergencia y las solicitudes de ayuda.
// Al pedir ayuda, el backend le envía un mensaje de texto (SMS) al contacto de emergencia.

async function obtenerTokenRequerido(): Promise<string> {
    const token = await obtenerToken();

    if (!token) {
        throw new Error("Debes iniciar sesión para realizar esta operación.");
    }

    return token;
}

// Contacto de emergencia del paciente; null si no tiene uno registrado
export async function obtenerContactoEmergencia(): Promise<ContactoEmergenciaResponse | null> {
    const token = await obtenerTokenRequerido();

    try {
        return await apiRequest<ContactoEmergenciaResponse>(
            "/api/emergencias/contacto",
            "GET",
            undefined,
            token
        );
    } catch (e) {
        if (e instanceof ApiError && e.status === 404) {
            return null;
        }
        throw e;
    }
}

// Registrar o actualizar el contacto de emergencia (teléfono de 10 dígitos)
export async function guardarContactoEmergencia(
    datos: ContactoEmergenciaRequest
): Promise<ContactoEmergenciaResponse> {
    const token = await obtenerTokenRequerido();

    return await apiRequest<ContactoEmergenciaResponse>(
        "/api/emergencias/contacto",
        "PUT",
        datos,
        token
    );
}

// Quitar el contacto de emergencia
export async function eliminarContactoEmergencia(): Promise<void> {
    const token = await obtenerTokenRequerido();

    await apiRequest<void>("/api/emergencias/contacto", "DELETE", undefined, token);
}

// Pedir ayuda: crea la solicitud y envía el SMS al contacto (estado ENVIADA o FALLIDA)
export async function solicitarEmergencia(
    datos: SolicitudEmergenciaRequest
): Promise<SolicitudEmergenciaResponse> {
    const token = await obtenerTokenRequerido();

    return await apiRequest<SolicitudEmergenciaResponse>(
        "/api/emergencias",
        "POST",
        datos,
        token
    );
}

// Solicitudes anteriores, de la más reciente a la más antigua
export async function listarEmergencias(): Promise<SolicitudEmergenciaResponse[]> {
    const token = await obtenerTokenRequerido();

    return await apiRequest<SolicitudEmergenciaResponse[]>(
        "/api/emergencias",
        "GET",
        undefined,
        token
    );
}

// Marcar como atendida una solicitud enviada
export async function marcarEmergenciaAtendida(
    id: number
): Promise<SolicitudEmergenciaResponse> {
    const token = await obtenerTokenRequerido();

    return await apiRequest<SolicitudEmergenciaResponse>(
        `/api/emergencias/${id}/atendida`,
        "PATCH",
        undefined,
        token
    );
}