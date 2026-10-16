import type { ActividadSaludResponse } from '@/dto/ActividadSaludResponse';
import type { EstadoActividad } from '@/dto/EstadoActividad';
import { EstadoTomaMed } from '@/dto/EstadoTomaMed';
import type { HorarioMedicamentoResponse } from '@/dto/HorarioMedicamentoResponse';
import type { TipoActividad } from '@/dto/TipoActividad';
import { TipoFrecuenciaMedicamento } from '@/dto/TipoFrecuenciaMedicamento';
import type { TipoRecordatorio } from '@/dto/TipoRecordatorio';
import type { TomaMedicamentoResponse } from '@/dto/TomaMedicamentoResponse';

import { aDia, aFechaHoraLocal, deFechaLocal, horaCorta } from './fechas';

/**
 * Ayudas del calendario de salud (actividades, recordatorios, medicamentos, horarios y tomas):
 * nombres en español, descripciones en palabras, rangos de fechas y cómo se entiende
 * una fecha o una hora escrita o dictada.
 */

// ---------------------------------------------------------------------------------------------
// Nombres en español
// ---------------------------------------------------------------------------------------------

export const TIPOS_ACTIVIDAD: { valor: TipoActividad; titulo: string }[] = [
    { valor: 'CITA_MEDICA', titulo: 'Cita médica' },
    { valor: 'TERAPIA', titulo: 'Terapia' },
    { valor: 'OTRO', titulo: 'Otra' },
];

export const nombreTipoActividad = (tipo: TipoActividad) => TIPOS_ACTIVIDAD.find((t) => t.valor === tipo)?.titulo ?? 'Actividad';

export function nombreEstadoActividad(estado: EstadoActividad): string {
    return estado === 'COMPLETADA' ? 'Realizada' : estado === 'CANCELADA' ? 'Cancelada' : 'Pendiente';
}

export const TIPOS_AVISO: { valor: TipoRecordatorio; titulo: string }[] = [
    { valor: 'VOCAL', titulo: 'Voz' },
    { valor: 'SONORA', titulo: 'Sonido' },
    { valor: 'VISUAL', titulo: 'Visual' },
];

export const nombreTipoAviso = (tipo: TipoRecordatorio) => TIPOS_AVISO.find((t) => t.valor === tipo)?.titulo ?? tipo;

export function nombreEstadoToma(estado: EstadoTomaMed): string {
    switch (estado) {
        case EstadoTomaMed.TOMADO:
            return 'Tomado';
        case EstadoTomaMed.OMITIDO:
            return 'Omitido';
        case EstadoTomaMed.CANCELADO:
            return 'Cancelado';
        default:
            return 'Pendiente';
    }
}

/** Una toma que todavía se puede marcar como tomada (pendiente o ya avisada). */
export const tomaPorMarcar = (toma: TomaMedicamentoResponse) =>
    toma.estado === EstadoTomaMed.PENDIENTE || toma.estado === EstadoTomaMed.NOTIFICADO;

/** Una toma pendiente se sigue mostrando hasta 1 hora después, para poder marcar "Ya lo tomé" si se tomó con algo de retraso. */
export const MARGEN_TOMA_MS = 60 * 60_000;

/** true si la fecha ya pasó (con un margen opcional en milisegundos). */
export const yaPaso = (fechaHora: string, margenMs = 0, ahora = Date.now()) => deFechaLocal(fechaHora).getTime() < ahora - margenMs;

/** Tomas de hoy que todavía importan: las que vienen y las pendientes de la última hora. */
export const tomaVigente = (toma: TomaMedicamentoResponse, ahora = Date.now()) => !yaPaso(toma.fechaHora, MARGEN_TOMA_MS, ahora);

/** Un horario sigue vigente si está activo y su fecha de fin (si tiene) no ha pasado. */
export const horarioVigente = (h: HorarioMedicamentoResponse, ahora = Date.now()) => h.activo && !(h.fechaHoraFin && yaPaso(h.fechaHoraFin, 0, ahora));

/** Actividades que todavía no han pasado. */
export const actividadVigente = (actividad: ActividadSaludResponse, ahora = Date.now()) => !yaPaso(actividad.fechaHora, 0, ahora);

export const FRECUENCIAS: { valor: TipoFrecuenciaMedicamento; titulo: string }[] = [
    { valor: TipoFrecuenciaMedicamento.CADA_X_HORAS, titulo: 'Cada X horas' },
    { valor: TipoFrecuenciaMedicamento.DIARIO, titulo: 'Diario' },
    { valor: TipoFrecuenciaMedicamento.DIAS_SEMANA, titulo: 'Algunos días' },
];

/** Días como los usa el backend (DayOfWeek de Java), de lunes a domingo. */
export const DIAS_SEMANA: { valor: string; corto: string; nombre: string; claves: string[] }[] = [
    { valor: 'MONDAY', corto: 'L', nombre: 'lunes', claves: ['lunes'] },
    { valor: 'TUESDAY', corto: 'M', nombre: 'martes', claves: ['martes'] },
    { valor: 'WEDNESDAY', corto: 'M', nombre: 'miércoles', claves: ['miercoles'] },
    { valor: 'THURSDAY', corto: 'J', nombre: 'jueves', claves: ['jueves'] },
    { valor: 'FRIDAY', corto: 'V', nombre: 'viernes', claves: ['viernes'] },
    { valor: 'SATURDAY', corto: 'S', nombre: 'sábado', claves: ['sabado', 'sabados'] },
    { valor: 'SUNDAY', corto: 'D', nombre: 'domingo', claves: ['domingo', 'domingos'] },
];

/** ["lunes", "miércoles", "viernes"] → "lunes, miércoles y viernes". */
export function enumerar(partes: string[]): string {
    if (partes.length <= 1) return partes.join('');
    return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
}

// ---------------------------------------------------------------------------------------------
// Horas y fechas en texto
// ---------------------------------------------------------------------------------------------

const dos = (n: number) => String(n).padStart(2, '0');

/** "20:00:00" → "8:00 p. m." */
export function horaDeTexto(hora: string): string {
    const [h, m] = hora.split(':').map(Number);
    const fecha = new Date();
    fecha.setHours(h ?? 0, m ?? 0, 0, 0);
    return horaCorta(fecha);
}

/** (20, 0) → "20:00:00", como lo espera el backend en horaProgramada. */
export const aHoraBackend = (horas: number, minutos: number) => `${dos(horas)}:${dos(minutos)}:00`;

/** "jueves 16 de octubre" */
export function diaLargo(fecha: Date): string {
    return fecha.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** Quita el punto repetido que queda cuando una frase termina en "a. m." o "p. m.": "8:00 p. m.." → "8:00 p. m.". */
export const sinPuntoDoble = (texto: string) => texto.replace(/\.(\s?)\./g, '.$1').replace(/\.\s?\./g, '.');

/** "Hoy", "Mañana" o "jueves 16 de octubre" (con mayúscula inicial). */
export function nombreDiaRelativo(fecha: Date, hoy = new Date()): string {
    const manana = new Date(hoy);
    manana.setDate(hoy.getDate() + 1);
    const ayer = new Date(hoy);
    ayer.setDate(hoy.getDate() - 1);
    if (aDia(fecha) === aDia(hoy)) return 'Hoy';
    if (aDia(fecha) === aDia(manana)) return 'Mañana';
    if (aDia(fecha) === aDia(ayer)) return 'Ayer';
    const texto = diaLargo(fecha);
    return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** "Hoy, 9:30 a. m.", "Mañana, 3:00 p. m." o "Jueves 16 de octubre, 9:30 a. m." */
export function cuandoActividad(fechaHora: string): string {
    const fecha = deFechaLocal(fechaHora);
    return `${nombreDiaRelativo(fecha)}, ${horaCorta(fecha)}`;
}

/** El horario en palabras: "Todos los días a las 8:00 p. m.", "Cada 8 horas desde …". */
export function describirHorario(h: HorarioMedicamentoResponse): string {
    const hora = h.horaProgramada ? horaDeTexto(h.horaProgramada) : '';
    let texto: string;
    if (h.tipoFrecuencia === TipoFrecuenciaMedicamento.CADA_X_HORAS) {
        const inicio = deFechaLocal(h.fechaHoraInicio);
        texto = `Cada ${h.intervaloHoras} ${h.intervaloHoras === 1 ? 'hora' : 'horas'}, desde las ${horaCorta(inicio)}`;
    } else if (h.tipoFrecuencia === TipoFrecuenciaMedicamento.DIAS_SEMANA) {
        const dias = DIAS_SEMANA.filter((d) => h.diasSemana?.includes(d.valor)).map((d) => d.nombre);
        const nombre = enumerar(dias);
        texto = `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} a las ${hora}`;
    } else {
        texto = `Todos los días a las ${hora}`;
    }
    return texto;
}

/** "Desde el 15 de octubre · hasta el 30 de octubre" */
export function vigenciaHorario(h: HorarioMedicamentoResponse): string {
    const corta = (t: string) => deFechaLocal(t).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
    return `Desde el ${corta(h.fechaHoraInicio)}${h.fechaHoraFin ? ` · hasta el ${corta(h.fechaHoraFin)}` : ''}`;
}

// ---------------------------------------------------------------------------------------------
// Rangos para consultar al backend (fecha con hora, inclusivos)
// ---------------------------------------------------------------------------------------------

export function rangoDelDia(fecha: Date): { desde: string; hasta: string } {
    const inicio = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 0, 0, 0);
    const fin = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 23, 59, 0);
    return { desde: aFechaHoraLocal(inicio), hasta: aFechaHoraLocal(fin).replace(/:00$/, ':59') };
}

/** Lunes a domingo de la semana que contiene la fecha. */
export function rangoDeLaSemana(fecha: Date): { desde: string; hasta: string; lunes: Date } {
    const lunes = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
    lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7));
    const domingo = new Date(lunes);
    domingo.setDate(lunes.getDate() + 6);
    return { desde: rangoDelDia(lunes).desde, hasta: rangoDelDia(domingo).hasta, lunes };
}

/** Las actividades agrupadas por día ("2026-10-16" → actividades de ese día, en orden de hora). */
export function actividadesPorDia(actividades: ActividadSaludResponse[]): Record<string, ActividadSaludResponse[]> {
    const grupos: Record<string, ActividadSaludResponse[]> = {};
    for (const a of [...actividades].sort((x, y) => x.fechaHora.localeCompare(y.fechaHora))) {
        const dia = a.fechaHora.slice(0, 10);
        (grupos[dia] ??= []).push(a);
    }
    return grupos;
}

// ---------------------------------------------------------------------------------------------
// Fecha y hora futuras escritas o dictadas: "mañana", "el viernes", "20/10/2026", "a las 9 y media"
// ---------------------------------------------------------------------------------------------

function sinTildes(texto: string): string {
    return texto
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[,;!?¡¿]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

const NUMEROS: Record<string, number> = {
    una: 1, uno: 1, un: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
    once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18,
    diecinueve: 19, veinte: 20, veintiuno: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, treinta: 30,
};
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const aNumero = (t?: string) => (t === undefined ? null : /^\d+$/.test(t) ? Number(t) : (NUMEROS[t] ?? null));

/**
 * Una hora escrita o dicha: "9", "9:30", "9 y media", "3 pm", "3 de la tarde", "21:00", "mediodía".
 * Sin a. m. ni p. m., de 1 a 6 se toma como de la tarde y de 7 a 11 como de la mañana.
 */
export function interpretarHora(texto: string): { horas: number; minutos: number } | null {
    const t = sinTildes(texto)
        // "8.30" se entiende como "8:30" (antes de quitar los puntos de "a. m.")
        .replace(/^(\d{1,2})\.(\d{2})\b/, '$1:$2')
        .replace(/\./g, '')
        .replace(/^(a las?|las?|como a las?|tipo)\s+/, '');
    if (!t) return null;
    if (/^(mediodia|medio dia|al mediodia)$/.test(t)) return { horas: 12, minutos: 0 };
    if (/^(medianoche|media noche)$/.test(t)) return { horas: 0, minutos: 0 };
    const m = /^(\d{1,2}|[a-z]+)(?:(?::|\s+y\s+)(\d{2}|media|cuarto|quince|treinta))?\s*(?:de la |en la |por la )?(manana|tarde|noche|madrugada|a ?m|p ?m)?$/.exec(t);
    if (!m) return null;
    let horas = aNumero(m[1]);
    if (horas === null || horas > 23) return null;
    const minutos = m[2] === 'media' ? 30 : m[2] === 'cuarto' ? 15 : (aNumero(m[2]) ?? 0);
    if (minutos > 59) return null;
    const momento = m[3];
    // Con "a. m." o "p. m." la hora va de 1 a 12 ("13:30 p. m." no es una hora válida)
    if (momento && /^(a ?m|p ?m)$/.test(momento) && (horas < 1 || horas > 12)) return null;
    if (momento && /(tarde|noche|p ?m)/.test(momento)) horas = horas < 12 ? horas + 12 : horas;
    else if (momento && /(manana|madrugada|a ?m)/.test(momento)) horas = horas === 12 ? 0 : horas;
    else if (!momento && horas >= 1 && horas <= 6) horas += 12;
    return { horas, minutos };
}

/** Un día escrito o dicho, de hoy en adelante: "hoy", "mañana", "pasado mañana", "el viernes", "20/10/2026", "20 de octubre". */
export function interpretarFecha(texto: string, hoy = new Date()): Date | null {
    const t = sinTildes(texto).replace(/^(el|este|para el|para)\s+/, '').replace(/^(proximo|siguiente)\s+/, '');
    if (!t) return null;
    const base = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const sumar = (n: number) => {
        const d = new Date(base);
        d.setDate(d.getDate() + n);
        return d;
    };
    if (t === 'hoy') return base;
    if (t === 'manana') return sumar(1);
    if (t === 'pasado manana') return sumar(2);
    const dia = DIAS_SEMANA.findIndex((d) => d.claves.includes(t));
    if (dia >= 0) {
        // De lunes (0) a domingo (6): el próximo con ese nombre (si es hoy, el de la semana siguiente)
        const hoyIndice = (base.getDay() + 6) % 7;
        return sumar(((dia - hoyIndice + 7) % 7) || 7);
    }
    const numerica = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/.exec(t) ?? /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
    if (numerica) {
        const esIso = numerica[1].length === 4;
        const [a, m, d] = esIso
            ? [Number(numerica[1]), Number(numerica[2]), Number(numerica[3])]
            : [Number(numerica[3] ?? base.getFullYear()), Number(numerica[2]), Number(numerica[1])];
        const fecha = new Date(a, m - 1, d);
        return fecha.getMonth() === m - 1 && fecha.getDate() === d ? fecha : null;
    }
    const conMes = /^(\d{1,2}|[a-z]+) de ([a-z]+)(?: de (\d{4}))?$/.exec(t);
    if (conMes) {
        const d = aNumero(conMes[1]);
        const m = MESES.indexOf(conMes[2]);
        if (d === null || m < 0) return null;
        let fecha = new Date(conMes[3] ? Number(conMes[3]) : base.getFullYear(), m, d);
        if (!conMes[3] && fecha < base) fecha = new Date(base.getFullYear() + 1, m, d);
        return fecha.getDate() === d ? fecha : null;
    }
    return null;
}

/**
 * "Mañana a las 9", "el viernes a las 3 de la tarde", "20/10/2026 9:30": separa el día y la hora.
 * Devuelve lo que entendió de cada parte (cualquiera puede faltar).
 */
export function separarFechaHora(texto: string): { fecha: Date | null; hora: { horas: number; minutos: number } | null } {
    const t = sinTildes(texto);
    const partes = /^(.*?)\s*(?:,\s*)?\b(?:a las?|a la)\s+(.+)$/.exec(t);
    if (partes) return { fecha: partes[1] ? interpretarFecha(partes[1]) : null, hora: interpretarHora(partes[2]) };
    const numerica = /^(\S+)\s+(\d{1,2}:\d{2}.*)$/.exec(t);
    if (numerica) return { fecha: interpretarFecha(numerica[1]), hora: interpretarHora(numerica[2]) };
    return { fecha: interpretarFecha(t), hora: interpretarHora(t) };
}

/** Une un día y una hora en un Date. */
export function unirFechaHora(fecha: Date, hora: { horas: number; minutos: number }): Date {
    return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), hora.horas, hora.minutos, 0);
}

/** "20/10/2026" (como se muestra en el campo de fecha). */
export const aTextoFecha = (fecha: Date) => `${dos(fecha.getDate())}/${dos(fecha.getMonth() + 1)}/${fecha.getFullYear()}`;

/** "9:30 a. m." (como se muestra en el campo de hora). */
export const aTextoHora = (fecha: Date) => horaCorta(fecha);