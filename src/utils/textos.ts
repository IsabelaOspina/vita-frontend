import type { Rol } from '@/dto/Rol';
import type { TipoDiscapacidad } from '@/dto/TipoDiscapacidad';

/** Cómo se muestra cada rol. */
export function nombreRol(rol: Rol): string {
    switch (rol) {
        case 'ADMIN':
            return 'Administrador';
        case 'PERSONAL_SALUD':
            return 'Personal de salud';
        default:
            return 'Paciente';
    }
}

const DISCAPACIDADES: Record<TipoDiscapacidad, string> = {
    VISUAL: 'Visual',
    AUDITIVA: 'Auditiva',
    COGNITIVA: 'Cognitiva',
    DEL_HABLA: 'Del habla',
};

export function nombreDiscapacidad(tipo: TipoDiscapacidad): string {
    return DISCAPACIDADES[tipo] ?? tipo;
}

/** "2026-10-13T16:57:00" → "13 de octubre de 2026". */
export function fechaLarga(iso: string): string {
    const fecha = new Date(iso);
    if (Number.isNaN(fecha.getTime())) return iso;
    return fecha.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Primer nombre, para saludar: "María Gómez" → "María". */
export function primerNombre(nombre: string): string {
    return nombre.trim().split(/\s+/)[0] ?? nombre;
}

/**
 * Decide debajo de qué campo va un error del backend, según su mensaje.
 * Por ejemplo, "Ya existe un usuario con ese correo" va debajo del correo.
 * Devuelve null si el error no es de ningún campo (por ejemplo, sin conexión).
 */
export function campoDelError<C extends string>(mensaje: string, reglas: [RegExp, C][]): C | null {
    return reglas.find(([patron]) => patron.test(mensaje))?.[1] ?? null;
}