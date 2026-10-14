/**
 * Fechas de VITA.
 *
 * El backend envía y recibe las fechas sin zona horaria, en la hora de Colombia:
 * días como "2026-10-14" y fecha con hora como "2026-10-14T15:30:00".
 */

const dosCifras = (n: number) => String(n).padStart(2, '0');

/** Date → "2026-10-14T15:30:00" (lo que espera el backend en fechaHora). */
export function aFechaHoraLocal(fecha: Date): string {
    return (
        `${fecha.getFullYear()}-${dosCifras(fecha.getMonth() + 1)}-${dosCifras(fecha.getDate())}` +
        `T${dosCifras(fecha.getHours())}:${dosCifras(fecha.getMinutes())}:00`
    );
}

/** Date → "2026-10-14" (lo que espera el backend en los filtros desde y hasta). */
export function aDia(fecha: Date): string {
    return `${fecha.getFullYear()}-${dosCifras(fecha.getMonth() + 1)}-${dosCifras(fecha.getDate())}`;
}

/** "2026-10-14" o "2026-10-14T15:30:00" → Date en la hora local. */
export function deFechaLocal(texto: string): Date {
    const [dia, hora = '00:00:00'] = texto.split('T');
    const [a, m, d] = dia.split('-').map(Number);
    const [h, min, s] = hora.split(':').map(Number);
    return new Date(a, (m ?? 1) - 1, d ?? 1, h ?? 0, min ?? 0, Math.floor(s ?? 0));
}

/** El día de hoy menos n días, como "2026-10-08". */
export function diasAtras(dias: number): string {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() - dias);
    return aDia(fecha);
}

function mismoDia(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** "9:30 a. m." */
export function horaCorta(fecha: Date): string {
    return fecha.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true });
}

/** "Hoy, 9:30 a. m.", "Ayer, 6:10 p. m." o "12 oct., 8:00 a. m." */
export function fechaHoraCorta(texto: string): string {
    const fecha = deFechaLocal(texto);
    const hoy = new Date();
    const ayer = new Date();
    ayer.setDate(hoy.getDate() - 1);
    const dia = mismoDia(fecha, hoy)
        ? 'Hoy'
        : mismoDia(fecha, ayer)
            ? 'Ayer'
            : fecha.toLocaleDateString('es-CO', {
                day: 'numeric',
                month: 'short',
                year: fecha.getFullYear() === hoy.getFullYear() ? undefined : 'numeric',
            });
    return `${dia}, ${horaCorta(fecha)}`;
}

/** "martes, 14 de octubre de 2026, 9:30 a. m." */
export function fechaHoraLarga(texto: string): string {
    const fecha = deFechaLocal(texto);
    const dia = fecha.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    return `${dia}, ${horaCorta(fecha)}`;
}

/** "14 oct." (para las etiquetas de la gráfica). */
export function diaCorto(texto: string): string {
    return deFechaLocal(texto).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

/** "octubre de 2026" (para la gráfica agrupada por mes). */
export function mesLargo(texto: string): string {
    return deFechaLocal(texto).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
}

/** Date → "14/10/2026 09:30" (como se muestra en el campo "¿Cuándo?" al editar). */
export function aTextoCampo(fecha: Date): string {
    return `${dosCifras(fecha.getDate())}/${dosCifras(fecha.getMonth() + 1)}/${fecha.getFullYear()} ${dosCifras(fecha.getHours())}:${dosCifras(fecha.getMinutes())}`;
}

// ---------------------------------------------------------------------------------------------
// "¿Cuándo?" escrito o dictado: "ahora", "hace 2 horas", "ayer a las 8 de la noche", "14/10/2026 09:30"
// ---------------------------------------------------------------------------------------------

const NUMEROS: Record<string, number> = {
    un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
    once: 11, doce: 12, quince: 15, veinte: 20, treinta: 30, cuarenta: 40, 'cuarenta y cinco': 45, media: 30,
};

const NUMERO = '(\\d{1,2}|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|quince|veinte|treinta|cuarenta y cinco|cuarenta|media)';

function aNumero(texto: string | undefined): number | null {
    if (texto === undefined) return null;
    if (/^\d+$/.test(texto)) return Number(texto);
    return NUMEROS[texto] ?? null;
}

function sinTildes(texto: string): string {
    return texto
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[.,;!?¡¿]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Ajusta la hora según "de la mañana / tarde / noche", "a. m." o "p. m.". */
function horaDelDia(hora: number, momento: string | undefined): number {
    if (!momento) return hora;
    if (/(tarde|noche|p ?m)/.test(momento)) return hora < 12 ? hora + 12 : hora;
    if (/(madrugada|manana|a ?m)/.test(momento)) return hora === 12 ? 0 : hora;
    if (/mediodia/.test(momento)) return 12;
    return hora;
}

/**
 * Convierte lo que la persona escribió o dijo en una fecha y hora.
 * Devuelve null si no se entiende.
 */
export function interpretarCuando(texto: string, ahora = new Date()): Date | null {
    const t = sinTildes(texto)
        .replace(/^(fue|empezo|comenzo|lo senti|lo sentí|desde|el|la)\s+/, '')
        .trim();
    if (!t) return null;

    // "ahora", "ahorita", "en este momento", "justo ahora"
    if (/^(ahora|ahorita|ya|justo ahora|en este momento|hace un momento|hace un rato|recien)$/.test(t)) return new Date(ahora);

    if (t === 'hace media hora') return new Date(ahora.getTime() - 30 * 60000);

    // "hace 2 horas", "hace media hora", "hace 30 minutos", "hace una hora y media"
    const hace = new RegExp(`^hace ${NUMERO} (hora|horas|minuto|minutos|min|dia|dias)( y media)?$`).exec(t);
    if (hace) {
        const cantidad = aNumero(hace[1]) ?? 0;
        const fecha = new Date(ahora);
        if (hace[2].startsWith('hora')) fecha.setMinutes(fecha.getMinutes() - cantidad * 60 - (hace[3] ? 30 : 0));
        else if (hace[2].startsWith('dia')) fecha.setDate(fecha.getDate() - cantidad);
        else fecha.setMinutes(fecha.getMinutes() - cantidad);
        return fecha;
    }

    // "14/10/2026 09:30" o "2026-10-14 09:30" (la hora es opcional)
    const numerica =
        /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?: (\d{1,2}):(\d{2}))?(?: ?(a ?m|p ?m))?$/.exec(t) ??
        /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ t](\d{1,2}):(\d{2}))?$/.exec(t);
    if (numerica) {
        const esIso = numerica[1].length === 4;
        const [a, m, d] = esIso
            ? [Number(numerica[1]), Number(numerica[2]), Number(numerica[3])]
            : [Number(numerica[3]), Number(numerica[2]), Number(numerica[1])];
        const hora = horaDelDia(Number(numerica[4] ?? 12), numerica[6]);
        const fecha = new Date(a, m - 1, d, hora, Number(numerica[5] ?? 0));
        return fecha.getMonth() === m - 1 && fecha.getDate() === d ? fecha : null;
    }

    // Día: hoy, ayer, antier / anteayer, "esta mañana", "anoche"
    let dias = 0;
    let resto = t;
    let momentoDia: string | undefined;
    const dia = /^(hoy|ayer|antier|anteayer|antes de ayer|anoche|esta (manana|tarde|noche|madrugada))\b\s*/.exec(resto);
    if (dia) {
        if (dia[1] === 'ayer') dias = 1;
        else if (/^(antier|anteayer|antes de ayer)$/.test(dia[1])) dias = 2;
        else if (dia[1] === 'anoche') {
            dias = 1;
            momentoDia = 'noche';
        } else if (dia[2]) momentoDia = dia[2];
        resto = resto.slice(dia[0].length);
    }
    // "ayer en la tarde", "ayer por la noche"
    const momentoSuelto = /^(?:en|por|a) la (manana|tarde|noche|madrugada)\s*/.exec(resto);
    if (momentoSuelto) {
        momentoDia = momentoSuelto[1];
        resto = resto.slice(momentoSuelto[0].length);
    }
    if (/^al mediodia\s*/.test(resto)) {
        momentoDia = 'mediodia';
        resto = resto.replace(/^al mediodia\s*/, '');
    }

    // Hora: "a las 8", "a las 8 y media", "a las 3:15 pm", "a la 1 de la tarde"
    const conHora = new RegExp(
        `^(?:a las?|como a las?|tipo)?\\s*${NUMERO}(?:(?::| y )(\\d{2}|media|cuarto|quince|treinta))?\\s*(?:de la |en la |por la )?(manana|tarde|noche|madrugada|a ?m|p ?m)?$`,
    ).exec(resto);

    if (!dia && !momentoSuelto && !momentoDia && !conHora) return null;
    if (resto && !conHora) return null;

    const fecha = new Date(ahora);
    fecha.setDate(fecha.getDate() - dias);
    fecha.setSeconds(0, 0);

    if (conHora) {
        let hora = aNumero(conHora[1]) ?? 0;
        const min = conHora[2] === 'media' ? 30 : conHora[2] === 'cuarto' ? 15 : (aNumero(conHora[2]) ?? 0);
        const momento = conHora[3] ?? momentoDia;
        if (hora > 23 || min > 59) return null;
        if (momento) {
            fecha.setHours(horaDelDia(hora, momento), min);
            return fecha;
        }
        // "a las 8" (hoy) sin decir si es de mañana o de noche: la hora más reciente que ya pasó
        if (dias === 0) {
            const opciones = hora < 12 ? [hora + 12, hora] : [hora];
            for (const h of opciones) {
                const opcion = new Date(fecha);
                opcion.setHours(h, min);
                if (opcion <= ahora) return opcion;
            }
            fecha.setDate(fecha.getDate() - 1);
            fecha.setHours(opciones[0], min);
            return fecha;
        }
        fecha.setHours(hora, min);
        return fecha;
    }

    // Solo el día o el momento: una hora típica
    const HORAS: Record<string, number> = { madrugada: 3, manana: 8, mediodia: 12, tarde: 15, noche: 21 };
    if (momentoDia) fecha.setHours(HORAS[momentoDia] ?? 12, 0);
    else if (dias > 0) fecha.setHours(12, 0);
    else return new Date(ahora);
    return fecha;
}