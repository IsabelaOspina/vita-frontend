import type { NivelIntensidad } from "./NivelIntensidad";

export interface SintomaResponse {
    id: number;
    tipo: string;
    intensidad: number;
    nivelIntensidad: NivelIntensidad;
    fechaHora: string;
    observaciones: string | null;
    fechaRegistro: string;
    fechaActualizacion: string | null;
    textoLectura: string;
}