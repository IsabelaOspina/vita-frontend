import type { NivelIntensidad } from '@/dto/NivelIntensidad';
import type { OrdenSintoma } from '@/dto/OrdenSintoma';
import type { Tendencia } from '@/dto/Tendencia';

import { aPalabras, normalizar } from './comandos-voz';

/** Igual que en el backend: LEVE 1-3, MODERADA 4-6, SEVERA 7-10. */
export function nivelDe(intensidad: number): NivelIntensidad {
    if (intensidad >= 7) return 'SEVERA';
    if (intensidad >= 4) return 'MODERADA';
    return 'LEVE';
}

export function nombreNivel(nivel: NivelIntensidad): string {
    return nivel === 'SEVERA' ? 'Severa' : nivel === 'MODERADA' ? 'Moderada' : 'Leve';
}

export function nombreTendencia(tendencia: Tendencia): string {
    switch (tendencia) {
        case 'MEJORANDO':
            return 'Mejorando';
        case 'EMPEORANDO':
            return 'Empeorando';
        case 'ESTABLE':
            return 'Estable';
        default:
            return 'Sin datos suficientes';
    }
}

/** "5.4" → "5,4" (como se dice en Colombia). */
export function decimal(valor: number | null | undefined): string {
    if (valor === null || valor === undefined) return '—';
    return valor.toLocaleString('es-CO', { maximumFractionDigits: 1 });
}

/** Síntomas que se sugieren cuando la persona todavía no ha registrado ninguno. */
export const SINTOMAS_COMUNES = ['Dolor de cabeza', 'Mareo', 'Náuseas', 'Cansancio', 'Fiebre', 'Dolor de estómago'];

// ---------------------------------------------------------------------------------------------
// Filtros del historial
// ---------------------------------------------------------------------------------------------

export type Periodo = 'todo' | 'hoy' | 'semana' | 'mes';

export const PERIODOS: { valor: Periodo; titulo: string; dias: number | null }[] = [
    { valor: 'todo', titulo: 'Todo', dias: null },
    { valor: 'hoy', titulo: 'Hoy', dias: 0 },
    { valor: 'semana', titulo: '7 días', dias: 6 },
    { valor: 'mes', titulo: '30 días', dias: 29 },
];

export const ORDENES: { valor: OrdenSintoma; titulo: string }[] = [
    { valor: 'RECIENTES', titulo: 'Más recientes' },
    { valor: 'INTENSIDAD', titulo: 'Más intensos' },
    { valor: 'ANTIGUOS', titulo: 'Más antiguos' },
];

// ---------------------------------------------------------------------------------------------
// Intensidad dicha o escrita
// ---------------------------------------------------------------------------------------------

const PALABRAS_NUMERO: Record<string, number> = {
    uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
};

/** "7", "siete", "un 7", "7 de 10", "nivel diez" → número del 1 al 10. null si no es válido. */
export function numeroIntensidad(texto: string): number | null {
    const palabras = aPalabras(texto)
        .replace(/\b(de|sobre) (10|diez)\b/, '')
        .split(' ')
        .filter(Boolean);
    for (const palabra of palabras) {
        const numero = /^\d+$/.test(palabra) ? Number(palabra) : PALABRAS_NUMERO[palabra];
        if (numero !== undefined) return numero >= 1 && numero <= 10 ? numero : null;
    }
    // "leve", "moderada", "fuerte"
    if (palabras.some((p) => /^(insoportable|horrible)$/.test(p))) return 10;
    if (palabras.some((p) => /^(severa|severo|fuerte|muy)$/.test(p))) return 8;
    if (palabras.some((p) => /^(moderada|moderado|media|regular)$/.test(p))) return 5;
    if (palabras.some((p) => /^(leve|poquito|poco|suave)$/.test(p))) return 2;
    return null;
}

// ---------------------------------------------------------------------------------------------
// "Registra dolor de cabeza intensidad 7 hace dos horas"
// ---------------------------------------------------------------------------------------------

export type SintomaDictado = { tipo?: string; intensidad?: number; cuando?: string };

/** Verbos con que se pide registrar un síntoma por voz. */
const REGISTRAR =
    /^(?:(?:quiero|voy a|vamos a|puedes|por favor)\s+)*(?:registra|registrar|registrame|anota|anotar|anotame|agrega|agregar|guarda|guardar|nuevo sintoma|tengo|siento|me siento|estoy con|sufro de)\b\s*(?:(?:un|una|el|la|sintoma|sintomas|de|que es)\s+)*/;

/** "me duele la cabeza" → "Dolor de cabeza". */
const ME_DUELE = /^me (?:duele|duelen|esta doliendo)\s+(?:mucho\s+|un poco\s+)?(?:el|la|los|las|mi|mis)?\s*(.+)$/;

/** Dónde empieza el "cuándo" dentro de la frase. */
const CUANDO = /\b(hace \S+(?: y media)? (?:hora|horas|minuto|minutos|dia|dias)|ahora|ahorita|desde .+|ayer\b.*|anoche\b.*|antier\b.*|anteayer\b.*|hoy\b.*|esta (?:manana|tarde|noche|madrugada)\b.*|a las? \d.*|a las? (?:una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\b.*)$/;

/** Dónde empieza la intensidad dentro de la frase. */
const INTENSIDAD = /\b(?:con\s+)?(?:intensidad|nivel|de fuerza|fuerza)(?:\s+(?:de|es de|es|a|en|sera))?\s+(\S+)(?:\s+(?:de|sobre)\s+(?:10|diez))?/;
const INTENSIDAD_FINAL = /\b(?:un|una)?\s*(\d{1,2}|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(?:de|sobre)\s+(?:10|diez)\b/;

/** Primera letra en mayúscula: "dolor de cabeza" → "Dolor de cabeza". */
function capitalizar(texto: string): string {
    const limpio = texto.trim().replace(/\s+/g, ' ');
    return limpio.charAt(0).toUpperCase() + limpio.slice(1);
}

/**
 * Separa una frase dictada en tipo, intensidad y cuándo.
 *
 * Con `exigirVerbo`, solo se acepta si empieza con "registra", "tengo", "me duele"…
 * (así, en la lista de síntomas, cualquier otra frase no se toma como un síntoma nuevo).
 * Devuelve null si no hay nada que registrar.
 */
export function separarSintoma(texto: string, exigirVerbo: boolean): SintomaDictado | null {
    // Se trabaja con dos versiones del mismo largo: sin tildes (para buscar) y la original (para el síntoma)
    let original = texto.toLowerCase().replace(/[.,;:!?¡¿"']/g, ' ').replace(/\s+/g, ' ').trim();
    let frase = normalizar(original);
    const cortar = (desde: number, hasta = frase.length) => {
        original = original.slice(desde, hasta).trim();
        frase = normalizar(original);
    };

    const verbo = REGISTRAR.exec(frase);
    const duele = ME_DUELE.exec(frase);
    if (exigirVerbo && !verbo && !duele) return null;
    if (verbo && !duele) cortar(verbo[0].length);

    const resultado: SintomaDictado = {};

    const cuando = CUANDO.exec(frase);
    if (cuando) {
        resultado.cuando = cuando[1].replace(/^desde\s+/, '');
        cortar(0, cuando.index);
    }

    const intensidad = INTENSIDAD.exec(frase) ?? INTENSIDAD_FINAL.exec(frase);
    if (intensidad) {
        const numero = numeroIntensidad(intensidad[1]);
        if (numero !== null) resultado.intensidad = numero;
        original = `${original.slice(0, intensidad.index)} ${original.slice(intensidad.index + intensidad[0].length)}`.replace(/\s+/g, ' ');
        cortar(0);
    }

    // Lo que queda es el síntoma
    const sobrante = /^(?:(?:y|con|de|cambia|cambiar|pon|ponle|ponme|sube|baja)\s+)*(.*?)(?:\s+(?:y|con|de|a))*$/.exec(frase);
    if (sobrante) cortar(sobrante.index + frase.indexOf(sobrante[1]), frase.indexOf(sobrante[1]) + sobrante[1].length);
    const dolor = ME_DUELE.exec(frase);
    if (dolor) original = `dolor de ${original.slice(frase.length - dolor[1].length)}`;
    // "registrar síntoma" no dice cuál, y en "la intensidad es diez" sobra "la": no son un síntoma
    if (original && !/^(?:(?:un |una |el |mi )?(?:sintoma|sintomas|algo|uno)|la|el|los|las|a|y|es)$/.test(normalizar(original))) {
        resultado.tipo = capitalizar(original);
    }

    return resultado.tipo || resultado.intensidad || resultado.cuando ? resultado : null;
}