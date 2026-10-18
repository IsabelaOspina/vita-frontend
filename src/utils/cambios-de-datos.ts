/**
 * Aviso interno de "cambiaron datos en el backend" (se creó, editó o canceló algo).
 *
 * api.ts lo dispara después de cada POST/PUT/PATCH/DELETE exitoso, y el vigilante de recordatorios
 * lo escucha para volver a programar de inmediato las notificaciones del celular. Así, si alguien
 * crea un recordatorio y cierra VITA enseguida, el aviso ya queda programado (antes había que esperar
 * hasta 30 segundos a la siguiente consulta, y si la app se cerraba antes, no llegaba).
 *
 * No importa nada de la app, para no crear dependencias circulares.
 */
let oyente: (() => void) | null = null;
let temporizador: ReturnType<typeof setTimeout> | null = null;

/** Registra quién se entera de los cambios. Devuelve la función para quitarlo. */
export function alCambiarDatos(funcion: () => void): () => void {
    oyente = funcion;
    return () => {
        if (oyente === funcion) oyente = null;
    };
}

/** Avisa que cambiaron datos. Si llegan varios cambios seguidos, se avisa una sola vez. */
export function datosCambiaron() {
    if (!oyente) return;
    if (temporizador) clearTimeout(temporizador);
    temporizador = setTimeout(() => {
        temporizador = null;
        oyente?.();
    }, 700);
}