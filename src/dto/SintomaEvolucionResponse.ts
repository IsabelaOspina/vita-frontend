import type { AgrupacionTiempo } from "./AgrupacionTiempo";
import type { SintomaEvolucionPunto } from "./SintomaEvolucionPunto";
import type { Tendencia } from "./Tendencia";

export interface SintomaEvolucionResponse {
    tipo: string | null;
    desde: string;
    hasta: string;
    agrupacion: AgrupacionTiempo;
    puntos: SintomaEvolucionPunto[];
    tendencia: Tendencia;
    textoLectura: string;
}