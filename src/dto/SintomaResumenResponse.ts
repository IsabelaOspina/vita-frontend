import type { SintomaTipoResumen } from "./SintomaTipoResumen";

export interface SintomaResumenResponse {
    desde: string;
    hasta: string;
    totalRegistros: number;
    diasConRegistro: number;
    intensidadPromedio: number | null;
    intensidadMaxima: number | null;
    intensidadMinima: number | null;
    porTipo: SintomaTipoResumen[];
    textoLectura: string;
}