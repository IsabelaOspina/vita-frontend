import type { EstadoEmergencia } from "./EstadoEmergencia";
import type { TipoEmergencia } from "./TipoEmergencia";

export interface SolicitudEmergenciaResponse {
    id: number;
    fechaHora: string;
    tipo: TipoEmergencia;
    ubicacion: string | null;
    estado: EstadoEmergencia;
    nombreContacto: string | null;
    telefonoContacto: string | null;
    latitud: number | null;
    longitud: number | null;
}