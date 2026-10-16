import { interpretarHora } from './salud';

/**
 * Las mismas reglas que valida el backend (UsuarioRequest, PersonalRequest y ContactoEmergenciaRequest),
 * con mensajes formales. Así el error aparece debajo del campo antes de enviar el formulario.
 * Cada función devuelve el mensaje de error, o null si el valor es válido.
 */

const SOLO_LETRAS = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/;

/** Nombre completo: obligatorio y solo letras y espacios. */
export function errorNombre(valor: string, obligatorio = 'El nombre es obligatorio'): string | null {
    const v = valor.trim();
    if (!v) return obligatorio;
    if (!SOLO_LETRAS.test(v)) return 'El nombre solo puede contener letras y espacios';
    return null;
}

/** Parentesco del contacto de emergencia: obligatorio y solo letras y espacios. */
export function errorParentesco(valor: string, obligatorio = 'El parentesco es obligatorio'): string | null {
    const v = valor.trim();
    if (!v) return obligatorio;
    if (!SOLO_LETRAS.test(v)) return 'El parentesco solo puede contener letras y espacios';
    return null;
}

/** Cédula: obligatoria, entre 7 y 15 dígitos y solo números. */
export function errorCedula(valor: string, obligatorio = 'La cédula es obligatoria'): string | null {
    const v = valor.trim();
    if (!v) return obligatorio;
    if (!/^\d{7,15}$/.test(v)) return 'La cédula debe tener entre 7 y 15 dígitos y solo números';
    return null;
}

/** Teléfono: exactamente 10 dígitos y solo números (si es opcional y está vacío, no hay error). */
export function errorTelefono(valor: string, { obligatorio = false, mensajeVacio = 'El teléfono es obligatorio' } = {}): string | null {
    const v = valor.trim();
    if (!v) return obligatorio ? mensajeVacio : null;
    if (!/^\d{10}$/.test(v)) return 'El teléfono debe tener exactamente 10 dígitos y solo números';
    return null;
}

/** Correo: obligatorio y con formato de correo. */
export function errorCorreo(valor: string, obligatorio = 'El correo es obligatorio'): string | null {
    const v = valor.trim();
    if (!v) return obligatorio;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'El correo no tiene un formato válido';
    return null;
}

/** Contraseña: al menos 8 caracteres. */
export function errorContrasena(valor: string): string | null {
    if (valor.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
    return null;
}

/** Ejemplo que se muestra cuando la hora no es válida. */
export const EJEMPLO_HORA = 'Ejemplo: 8:30 a. m. o 3:00 p. m.';

/** Hora: debe ser una hora real (de 0:00 a 23:59, o de 1 a 12 con a. m. / p. m.). */
export function errorHora(valor: string, obligatorio = 'La hora es obligatoria'): string | null {
    const v = valor.trim();
    if (!v) return obligatorio;
    if (!interpretarHora(v)) return `La hora no es válida. ${EJEMPLO_HORA}`;
    return null;
}
