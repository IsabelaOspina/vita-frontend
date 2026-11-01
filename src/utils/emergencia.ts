import type { EstadoEmergencia } from '@/dto/EstadoEmergencia';
import type { TipoEmergencia } from '@/dto/TipoEmergencia';

import { aPalabras } from './comandos-voz';

/** Línea de emergencias de Colombia. */
export const LINEA_EMERGENCIAS = '123';

/** Los tipos de emergencia, en el orden en que se muestran. */
export const TIPOS_EMERGENCIA: { valor: TipoEmergencia; titulo: string; descripcion: string }[] = [
    { valor: 'MEDICA', titulo: 'Emergencia médica', descripcion: 'Me siento mal o necesito atención de salud' },
    { valor: 'ACCIDENTE', titulo: 'Accidente', descripcion: 'Me caí, me golpeé o tuve un accidente' },
    { valor: 'OTRA', titulo: 'Otra emergencia', descripcion: 'Necesito ayuda por otro motivo' },
];

export function nombreTipoEmergencia(tipo: TipoEmergencia): string {
    return TIPOS_EMERGENCIA.find((t) => t.valor === tipo)?.titulo ?? 'Emergencia';
}

export function nombreEstadoEmergencia(estado: EstadoEmergencia): string {
    switch (estado) {
        case 'ENVIADA':
            return 'Alerta enviada';
        case 'FALLIDA':
            return 'No se pudo enviar';
        case 'ATENDIDA':
            return 'Atendida';
        case 'CANCELADA':
            return 'Cancelada';
        default:
            return 'Enviando';
    }
}

/**
 * Lo que dice la persona → tipo de emergencia. "Emergencia médica", "me siento mal" → MEDICA;
 * "tuve un accidente", "me caí" → ACCIDENTE; "otra" → OTRA. null si no se entiende.
 */
export function interpretarTipoEmergencia(texto: string): TipoEmergencia | null {
    const t = aPalabras(texto);
    if (/(accidente|me cai|caida|me golpee|golpe|me accidente|choque|me queme)/.test(t)) return 'ACCIDENTE';
    if (/(\bmedica\b|\bmedico\b|me siento mal|me duele|dolor|no puedo respirar|me desmayo|ambulancia)/.test(t)) return 'MEDICA';
    if (/^(otra|otro)\b|otra emergencia|otro motivo|otra cosa/.test(t)) return 'OTRA';
    return null;
}

/** "+573001234567" → "300 123 4567" (para mostrar y leer en voz alta). */
export function telefonoParaMostrar(telefono: string | null | undefined): string {
    if (!telefono) return '';
    const diez = telefonoDiezDigitos(telefono);
    return diez.length === 10 ? `${diez.slice(0, 3)} ${diez.slice(3, 6)} ${diez.slice(6)}` : telefono;
}

/** "+573001234567" → "3001234567" (el backend recibe 10 dígitos y devuelve el número con +57). */
export function telefonoDiezDigitos(telefono: string): string {
    const numero = telefono.replace(/\D/g, '');
    return numero.length === 12 && numero.startsWith('57') ? numero.slice(2) : numero;
}

/**
 * Escucha de emergencia (con el modo voz apagado): ¿lo que se oyó es alguien pidiendo ayuda?
 * Devuelve el tipo si lo dijo ("emergencia médica", "tuve un accidente") o null si solo pidió
 * ayuda ("auxilio", "pedir ayuda"). Devuelve undefined si no es un pedido de ayuda.
 *
 * Solo se aceptan frases claras: la escucha nunca envía la alerta sola (siempre pregunta antes),
 * pero tampoco debe abrir la pantalla por una conversación cualquiera.
 */
export function detectarPedidoDeAyuda(texto: string): TipoEmergencia | null | undefined {
    const t = aPalabras(texto);
    if (!t) return undefined;
    const pideAyuda =
        /^(ayuda|ayudame|ayudenme|ayuda por favor)$/.test(t) ||
        /\b(pedir ayuda|pide ayuda|necesito ayuda|ayudenme|ayudame por favor|ayuda por favor|auxilio|socorro|emergencia|ambulancia|tuve un accidente|me accidente|me cai)\b/.test(t);
    if (!pideAyuda) return undefined;
    return interpretarTipoEmergencia(t);
}