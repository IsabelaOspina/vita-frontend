export interface SintomaActualizarRequest {
    tipo: string;
    intensidad: number;
    fechaHora?: string;
    observaciones?: string;
}