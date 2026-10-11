import * as Speech from 'expo-speech';

/** Idioma de la voz. es-MX es la voz en español latino disponible en la mayoría de celulares. */
const IDIOMA_VOZ = 'es-MX';

type OyenteHabla = (hablando: boolean) => void;

const oyentes = new Set<OyenteHabla>();
let hablando = false;

function emitir(valor: boolean) {
    if (valor === hablando) return;
    hablando = valor;
    oyentes.forEach((oyente) => oyente(valor));
}

/** Después de que termina una frase, revisa si quedó otra en cola antes de avisar que terminó. */
function revisarSiTermino() {
    setTimeout(async () => {
        const sigue = await Speech.isSpeakingAsync().catch(() => false);
        if (!sigue) emitir(false);
    }, 250);
}

/**
 * Dice un texto en voz alta.
 * Con `esperar` se pone en cola detrás de lo que se esté diciendo, en vez de interrumpirlo.
 *
 * Todo lo que la app dice pasa por aquí, para que el asistente de voz sepa cuándo la app
 * está hablando y apague el micrófono mientras tanto (si no, se escucharía a sí misma).
 */
export function hablar(texto: string, esperar = false) {
    if (!esperar) Speech.stop();
    emitir(true);
    Speech.speak(texto, {
        language: IDIOMA_VOZ,
        rate: 0.95,
        onDone: revisarSiTermino,
        onStopped: revisarSiTermino,
        onError: revisarSiTermino,
    });
}

/** Detiene lo que se esté diciendo. */
export function callar() {
    Speech.stop();
    emitir(false);
}

/** Avisa cada vez que la app empieza o termina de hablar. Devuelve la función para dejar de escuchar. */
export function alCambiarHabla(oyente: OyenteHabla): () => void {
    oyentes.add(oyente);
    return () => oyentes.delete(oyente);
}

export function estaHablando() {
    return hablando;
}