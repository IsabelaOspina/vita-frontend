import type { TipoEmergencia } from "./TipoEmergencia";

export interface SolicitudEmergenciaRequest {
    tipo: TipoEmergencia;
    ubicacion?: string | null;
}