import type { TipoEmergencia } from "./TipoEmergencia";

export interface SolicitudEmergenciaRequest {
    tipo: TipoEmergencia;
    ubicacion?: string | null;
    latitud?: number | null;
    longitud?: number | null;
}