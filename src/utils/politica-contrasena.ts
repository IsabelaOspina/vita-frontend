/**
 * Política de contraseñas: las mismas reglas que PoliticaContrasena.java en el backend.
 * Mínimo 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial
 * (cualquier símbolo que no sea letra, número ni espacio). Las letras con tilde y la ñ cuentan
 * como letras. Además, como máximo 72 bytes (el límite de BCrypt; solo se nota con contraseñas muy largas).
 */

export type ClaveCriterio = 'longitud' | 'mayuscula' | 'minuscula' | 'numero' | 'especial' | 'diferente';

export type Criterio = {
    clave: ClaveCriterio;
    /** Cómo se muestra en la lista: "Mínimo 8 caracteres". */
    texto: string;
    /** Cómo se dice cuando falta: "8 caracteres como mínimo". */
    falta: string;
    cumple: boolean;
};

const LONGITUD_MINIMA = 8;
const MAXIMO_BYTES = 72;

const MAYUSCULA = /\p{Lu}/u;
const MINUSCULA = /\p{Ll}/u;
const NUMERO = /\p{Nd}/u;
/** Igual que el backend: lo que no es mayúscula, minúscula, número ni espacio. */
const ESPECIAL = /[^\p{Lu}\p{Ll}\p{Nd}\s]/u;

/** Cuántos caracteres tiene (un emoji cuenta como uno, igual que en el backend). */
function largo(valor: string) {
    return Array.from(valor).length;
}

/**
 * Los criterios y si ya se cumplen. Con `actual` se agrega "Diferente a la actual"
 * (al cambiar la contraseña desde la cuenta).
 */
export function criteriosContrasena(valor: string, actual?: string): Criterio[] {
    const criterios: Criterio[] = [
        { clave: 'longitud', texto: `Mínimo ${LONGITUD_MINIMA} caracteres`, falta: `${LONGITUD_MINIMA} caracteres como mínimo`, cumple: largo(valor) >= LONGITUD_MINIMA },
        { clave: 'mayuscula', texto: 'Una letra mayúscula', falta: 'una letra mayúscula', cumple: MAYUSCULA.test(valor) },
        { clave: 'minuscula', texto: 'Una letra minúscula', falta: 'una letra minúscula', cumple: MINUSCULA.test(valor) },
        { clave: 'numero', texto: 'Un número', falta: 'un número', cumple: NUMERO.test(valor) },
        { clave: 'especial', texto: 'Un carácter especial, por ejemplo: ! # $ % * ?', falta: 'un carácter especial, por ejemplo un signo de exclamación o un numeral', cumple: ESPECIAL.test(valor) },
    ];
    if (actual !== undefined) {
        criterios.push({
            clave: 'diferente',
            texto: 'Diferente a tu contraseña actual',
            falta: 'que sea diferente a tu contraseña actual',
            cumple: valor.length > 0 && valor !== actual,
        });
    }
    return criterios;
}

/** true si la contraseña cumple toda la política del backend. */
export function cumplePolitica(valor: string): boolean {
    return criteriosContrasena(valor).every((c) => c.cumple) && !esDemasiadoLarga(valor);
}

function esDemasiadoLarga(valor: string) {
    return new TextEncoder().encode(valor).length > MAXIMO_BYTES;
}

/** Une una lista para leerla: "a, b y c". */
function enumerar(partes: string[]) {
    return partes.length <= 1 ? (partes[0] ?? '') : `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
}

/**
 * El error que se muestra (y se lee en voz alta) si la contraseña no cumple:
 * dice exactamente qué le falta, no solo que "no es válida".
 */
export function errorPoliticaContrasena(valor: string, { vacia = 'Escribe una contraseña', actual }: { vacia?: string; actual?: string } = {}): string | null {
    if (!valor) return vacia;
    if (esDemasiadoLarga(valor)) return 'La contraseña es demasiado larga. Usa una más corta.';
    const faltan = criteriosContrasena(valor, actual).filter((c) => !c.cumple);
    if (!faltan.length) return null;
    return `A la contraseña le falta: ${enumerar(faltan.map((c) => c.falta))}.`;
}

/** Para las preguntas del asistente de voz. */
export const REQUISITOS_CONTRASENA_VOZ =
    'Debe tener mínimo 8 caracteres, con una mayúscula, una minúscula, un número y un carácter especial, por ejemplo un signo de exclamación.';