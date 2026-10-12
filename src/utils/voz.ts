import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

/**
 * Todo lo que la app dice en voz alta pasa por este archivo, para que el asistente
 * "Oye VITA" sepa cuándo la app está hablando y apague el micrófono mientras tanto
 * (si no, se escucharía a sí misma).
 */

/** Idioma por defecto si el dispositivo no tiene ninguna voz en español elegible. */
const IDIOMA_VOZ = 'es-MX';

/** Velocidad normal de la voz (1 = la del sistema) y sus límites ("habla más rápido / más despacio"). */
const VELOCIDAD_NORMAL = 1;
const VELOCIDAD_MINIMA = 0.7;
const VELOCIDAD_MAXIMA = 1.7;
const PASO_VELOCIDAD = 0.2;

/** Chrome corta sin avisar lo que dura más de unos 15 segundos: se habla en trozos cortos. */
const LARGO_MAXIMO_TROZO = 160;

type OyenteHabla = (hablando: boolean) => void;

const oyentes = new Set<OyenteHabla>();
let hablando = false;
let velocidad = VELOCIDAD_NORMAL;
let ultimoDicho = '';
/** Cuándo terminó de hablar por última vez (para reconocer el eco de su propia voz). */
let callóEn = 0;

/** Cada mensaje nuevo (que no espera en cola) abre un turno; los avisos de turnos viejos se ignoran. */
let turno = 0;
/** Trozos del turno actual que todavía no han terminado de decirse. */
let pendientes = 0;
let revision: ReturnType<typeof setInterval> | null = null;
let limite: ReturnType<typeof setTimeout> | null = null;
let hablandoHasta = 0;

/** Mientras hay un grupo abierto, los mensajes se juntan y se dicen todos de una vez al cerrarlo. */
let grupo: string[] | null = null;

// ---------------------------------------------------------------------------------------------
// Elección de la voz
// ---------------------------------------------------------------------------------------------

/** Preferencia de acento: primero el español de Colombia y luego el latinoamericano. */
const PUNTOS_IDIOMA: Record<string, number> = {
    'es-co': 25,
    'es-us': 20,
    'es-mx': 20,
    'es-419': 18,
    'es-ar': 15,
    'es-pe': 15,
    'es-cl': 15,
    'es-es': 8,
};

/** Nombres de voces femeninas conocidas (Edge, Windows, Chrome, Mac y iPhone). */
const VOCES_MUJER =
    /salome|dalia|paloma|elena|camila|elvira|ximena|abril|laia|sabina|helena|laura|paulina|monica|soledad|marisol|angelica|francisca|catalina|lupe|penelope|mia|google espa/i;
/** Nombres de voces masculinas conocidas, que se evitan. */
const VOCES_HOMBRE =
    /gonzalo|jorge|alonso|alvaro|pablo|raul|juan|diego|tomas|andres|emilio|gerardo|carlos|enrique|miguel|lorenzo|federico|mateo|dario/i;

let vozElegida: { identificador: string; idioma: string } | null = null;

/**
 * Elige la mejor voz de mujer en español que tenga el dispositivo. Las mejores son las
 * voces "Natural" de Microsoft Edge; en Chrome, la voz
 * de Google en español. Si no se elige, el navegador puede usar una voz cualquiera, incluso
 * una en inglés que lee el español de forma casi incomprensible.
 */
async function elegirVoz() {
    try {
        const voces = await Speech.getAvailableVoicesAsync();
        let mejor: { puntos: number; identificador: string; idioma: string } | null = null;
        for (const voz of voces) {
            const idioma = voz.language.replace('_', '-').toLowerCase();
            if (!idioma.startsWith('es')) continue;
            let puntos = PUNTOS_IDIOMA[idioma] ?? 10;
            if (VOCES_MUJER.test(voz.name)) puntos += 40;
            if (VOCES_HOMBRE.test(voz.name)) puntos -= 100;
            if (/natural|neural|online/i.test(voz.name)) puntos += 50;
            else if (/google/i.test(voz.name)) puntos += 35;
            if (voz.quality === Speech.VoiceQuality.Enhanced) puntos += 30;
            if (!mejor || puntos > mejor.puntos) mejor = { puntos, identificador: voz.identifier, idioma: voz.language };
        }
        if (mejor) vozElegida = { identificador: mejor.identificador, idioma: mejor.idioma };
    } catch {
        // Sin lista de voces se usa la voz por defecto del idioma
    }
}

if (typeof window !== 'undefined' || Platform.OS !== 'web') void elegirVoz();

// ---------------------------------------------------------------------------------------------
// Saber cuándo termina de hablar
// ---------------------------------------------------------------------------------------------

function emitir(valor: boolean) {
    if (valor === hablando) return;
    hablando = valor;
    oyentes.forEach((oyente) => oyente(valor));
}

function terminar() {
    if (revision) clearInterval(revision);
    if (limite) clearTimeout(limite);
    revision = null;
    limite = null;
    pendientes = 0;
    hablandoHasta = 0;
    if (hablando) callóEn = Date.now();
    emitir(false);
}

/**
 * Respaldo por si el sistema nunca avisa que terminó (pasa en Chrome): se pregunta cada poco
 * si sigue hablando, y además hay un tope de tiempo según el largo del texto.
 */
function vigilar(duracionEstimadaMs: number) {
    hablandoHasta = Math.max(hablandoHasta, Date.now()) + duracionEstimadaMs;

    if (limite) clearTimeout(limite);
    limite = setTimeout(terminar, Math.max(0, hablandoHasta - Date.now()) + 2500);

    if (revision) return;
    let silenciosSeguidos = 0;
    const miTurno = turno;
    // Se espera un momento antes de empezar a preguntar, porque la voz tarda en arrancar
    setTimeout(() => {
        if (!hablando || revision || miTurno !== turno) return;
        revision = setInterval(async () => {
            const sigue = await Speech.isSpeakingAsync().catch(() => false);
            // Dos respuestas seguidas de "no está hablando", para no confundir la pausa entre trozos con el final
            silenciosSeguidos = sigue ? 0 : silenciosSeguidos + 1;
            if (silenciosSeguidos >= 2) terminar();
        }, 350);
    }, 600);
}

function dividirEnTrozos(texto: string): string[] {
    // Solo se corta en un punto seguido de espacio, para no partir correos como gmail.com
    const frases = texto.split(/(?<=[.!?:])\s+/).map((f) => f.trim()).filter(Boolean);
    const trozos: string[] = [];
    for (const frase of frases) {
        const ultima = trozos[trozos.length - 1];
        if (ultima && (ultima + ' ' + frase).length <= LARGO_MAXIMO_TROZO) trozos[trozos.length - 1] = `${ultima} ${frase}`;
        else trozos.push(frase);
    }
    return trozos;
}

// ---------------------------------------------------------------------------------------------
// Hablar
// ---------------------------------------------------------------------------------------------

/**
 * Dice un texto en voz alta.
 * Con `esperar` se pone en cola detrás de lo que se esté diciendo, en vez de interrumpirlo.
 */
export function hablar(texto: string, esperar = false) {
    const limpio = texto.trim();
    if (!limpio) return;

    if (grupo) {
        grupo.push(limpio);
        return;
    }

    const enCola = esperar && hablando;
    if (!enCola) {
        Speech.stop();
        turno += 1;
        pendientes = 0;
        hablandoHasta = 0;
        if (revision) clearInterval(revision);
        revision = null;
    }
    ultimoDicho = enCola ? `${ultimoDicho} ${limpio}` : limpio;
    emitir(true);

    const miTurno = turno;
    const alTerminarTrozo = () => {
        if (miTurno !== turno) return;
        pendientes -= 1;
        if (pendientes <= 0) terminar();
    };

    for (const trozo of dividirEnTrozos(limpio)) {
        pendientes += 1;
        Speech.speak(trozo, {
            language: vozElegida?.idioma ?? IDIOMA_VOZ,
            ...(vozElegida && { voice: vozElegida.identificador }),
            rate: velocidad,
            onDone: alTerminarTrozo,
            onStopped: alTerminarTrozo,
            onError: alTerminarTrozo,
        });
    }
    // Unos 70 ms por letra a velocidad normal
    vigilar((limpio.length * 70) / velocidad + 400);
}

/** Detiene lo que se esté diciendo. */
export function callar() {
    grupo = null;
    turno += 1;
    Speech.stop();
    terminar();
}

/** Repite lo último que dijo la app. Devuelve false si todavía no ha dicho nada. */
export function repetir(): boolean {
    if (!ultimoDicho) return false;
    hablar(ultimoDicho);
    return true;
}

/** Junta todo lo que se diga hasta `cerrarGrupo` en un solo mensaje (para órdenes con varias partes). */
export function abrirGrupo() {
    grupo = [];
}

/** Dice de una vez todo lo que se juntó. Devuelve true si había algo para decir. */
export function cerrarGrupo(): boolean {
    const mensajes = grupo ?? [];
    grupo = null;
    if (mensajes.length === 0) return false;
    // Cada mensaje termina en su signo (las preguntas conservan el "?"); si no tiene, se le pone punto
    hablar(mensajes.map((m) => (/[.?!]$/.test(m.trim()) ? m.trim() : `${m.trim()}.`)).join(' '));
    return true;
}

/** Cambia la velocidad de la voz. Devuelve false si ya estaba en el límite. */
export function cambiarVelocidad(cambio: 'mas' | 'menos'): boolean {
    const nueva = velocidad + (cambio === 'mas' ? PASO_VELOCIDAD : -PASO_VELOCIDAD);
    if (nueva < VELOCIDAD_MINIMA - 0.01 || nueva > VELOCIDAD_MAXIMA + 0.01) return false;
    velocidad = Math.round(nueva * 10) / 10;
    return true;
}

/** Avisa cada vez que la app empieza o termina de hablar. Devuelve la función para dejar de escuchar. */
export function alCambiarHabla(oyente: OyenteHabla): () => void {
    oyentes.add(oyente);
    return () => oyentes.delete(oyente);
}

export function estaHablando() {
    return hablando;
}

/** Lo último que dijo la app. */
export function ultimoMensaje() {
    return ultimoDicho;
}

/** Cuántos milisegundos han pasado desde que la app terminó de hablar. */
export function tiempoDesdeQueCallo() {
    return Date.now() - callóEn;
}