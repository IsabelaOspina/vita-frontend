import type { Href } from 'expo-router';

import type { AgrupacionTiempo } from '@/dto/AgrupacionTiempo';
import type { PaginaResponse } from '@/dto/PaginaResponse';
import type { Rol } from '@/dto/Rol';
import type { SintomaEvolucionResponse } from '@/dto/SintomaEvolucionResponse';
import type { SintomaFiltro } from '@/dto/SintomaFiltro';
import type { SintomaResponse } from '@/dto/SintomaResponse';
import type { SintomaResumenResponse } from '@/dto/SintomaResumenResponse';
import {
    consultarEvolucionSintomasPaciente,
    consultarResumenSintomasPaciente,
    consultarSintomaPaciente,
    consultarSintomasPaciente,
} from '@/services/personalSaludService';
import {
    eliminarSintoma,
    listarSintomas,
    obtenerEvolucionSintomas,
    obtenerResumenSintomas,
    obtenerSintoma,
    obtenerTiposSintoma,
} from '@/services/sintomaService';

import { diasAtras } from './fechas';

/**
 * De dónde salen los síntomas que muestran las pantallas compartidas (lista, detalle y evolución).
 * - El paciente ve y modifica los suyos.
 * - El personal de salud ve los de un paciente asignado, solo para consultar.
 */
export type FuenteSintomas = {
    rol: Rol;
    /** El paciente puede registrar, editar y eliminar; el profesional solo consulta. */
    editable: boolean;
    listar: (filtro: SintomaFiltro) => Promise<PaginaResponse<SintomaResponse>>;
    obtener: (id: number) => Promise<SintomaResponse>;
    resumen: () => Promise<SintomaResumenResponse>;
    evolucion: (tipo: string | undefined, desde: string, agrupacion: AgrupacionTiempo) => Promise<SintomaEvolucionResponse>;
    /** Los tipos de síntoma que ha registrado, del más frecuente al menos frecuente. */
    tipos: () => Promise<string[]>;
    eliminar?: (id: number) => Promise<void>;
    rutas: {
        lista: Href;
        detalle: (id: number) => Href;
        /** El historial completo; puede abrirse con filtros ya puestos (periodo, tipo, nivel, orden). */
        historial: (filtros?: Record<string, string>) => Href;
        evolucion: Href;
        nuevo?: Href;
        editar?: (id: number) => Href;
    };
};

/** Los síntomas del paciente que inició sesión. */
export const fuentePaciente: FuenteSintomas = {
    rol: 'USUARIO',
    editable: true,
    listar: listarSintomas,
    obtener: obtenerSintoma,
    resumen: () => obtenerResumenSintomas(),
    evolucion: (tipo, desde, agrupacion) => obtenerEvolucionSintomas(tipo, desde, undefined, agrupacion),
    tipos: async () => (await obtenerTiposSintoma()).map((t) => t.tipo),
    eliminar: eliminarSintoma,
    rutas: {
        lista: '/paciente/sintomas',
        detalle: (id) => ({ pathname: '/paciente/sintomas/[id]', params: { id: String(id) } }),
        historial: (filtros) => ({ pathname: '/paciente/sintomas/historial', params: filtros ?? {} }),
        evolucion: '/paciente/sintomas/evolucion',
        nuevo: '/paciente/sintomas/nuevo',
        editar: (id) => ({ pathname: '/paciente/sintomas/editar/[id]', params: { id: String(id) } }),
    },
};

/** Los síntomas de un paciente asignado, vistos por su profesional de salud. */
export function fuenteProfesional(pacienteId: number, nombre: string): FuenteSintomas {
    const params = { paciente: String(pacienteId), nombre };
    return {
        rol: 'PERSONAL_SALUD',
        editable: false,
        listar: (filtro) => consultarSintomasPaciente(pacienteId, filtro),
        obtener: (id) => consultarSintomaPaciente(pacienteId, id),
        resumen: () => consultarResumenSintomasPaciente(pacienteId),
        evolucion: (tipo, desde, agrupacion) => consultarEvolucionSintomasPaciente(pacienteId, tipo, desde, undefined, agrupacion),
        // El profesional no tiene la consulta de tipos: se sacan del resumen del último año
        tipos: async () => {
            const resumen = await consultarResumenSintomasPaciente(pacienteId, diasAtras(365));
            return [...resumen.porTipo].sort((a, b) => b.cantidad - a.cantidad).map((t) => t.tipo);
        },
        rutas: {
            lista: { pathname: '/personal/paciente/[id]', params: { id: String(pacienteId), nombre } },
            detalle: (id) => ({ pathname: '/personal/paciente/sintoma', params: { ...params, sintoma: String(id) } }),
            historial: (filtros) => ({ pathname: '/personal/paciente/historial', params: { ...params, ...filtros } }),
            evolucion: { pathname: '/personal/paciente/evolucion', params },
        },
    };
}

/**
 * Mensaje para mostrar en la pantalla a la que se vuelve (por ejemplo "Se eliminó el síntoma…"
 * al volver del detalle al historial). La pantalla lo toma una sola vez al recibir el foco.
 */
let avisoPendiente: string | null = null;

export function dejarAvisoPendiente(mensaje: string) {
    avisoPendiente = mensaje;
}

export function tomarAvisoPendiente(): string | null {
    const mensaje = avisoPendiente;
    avisoPendiente = null;
    return mensaje;
}