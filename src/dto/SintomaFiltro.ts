import type { OrdenSintoma } from "./OrdenSintoma";

export interface SintomaFiltro {
    desde?: string;
    hasta?: string;
    tipo?: string;
    intensidadMin?: number;
    intensidadMax?: number;
    orden?: OrdenSintoma;
    pagina?: number;
    tamano?: number;
}