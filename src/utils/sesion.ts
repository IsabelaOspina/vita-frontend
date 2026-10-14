import { router } from 'expo-router';

import type { Rol } from '@/dto/Rol';
import type { UsuarioResponse } from '@/dto/UsuarioResponse';
import { ApiError } from '@/services/api';
import { eliminarToken, obtenerToken } from '@/utils/tokenStorage';

/** Una cuenta tal como la devuelve el backend (las de personal de salud traen `personalSalud`). */
export type Cuenta = UsuarioResponse;

/** Las pestañas de cada rol: su pantalla principal, "Mi cuenta" y "Accesibilidad". */
const RUTAS = {
    USUARIO: { inicio: '/paciente', miCuenta: '/paciente/mi-cuenta', accesibilidad: '/paciente/accesibilidad' },
    PERSONAL_SALUD: { inicio: '/personal', miCuenta: '/personal/mi-cuenta', accesibilidad: '/personal/accesibilidad' },
    ADMIN: { inicio: '/admin', miCuenta: '/admin/mi-cuenta', accesibilidad: '/admin/accesibilidad' },
} as const;

export function rutasDe(rol: Rol) {
    return RUTAS[rol] ?? RUTAS.USUARIO;
}

/** Pantalla principal de cada rol, a la que se llega después de iniciar sesión. */
export function rutaDeInicio(rol: Rol) {
    return rutasDe(rol).inicio;
}

/** Borra el token guardado y vuelve al inicio de sesión. */
export async function cerrarSesion() {
    await eliminarToken();
    router.replace('/login');
}

/** El token de la sesión. Si no hay (la sesión se cerró), lleva al inicio de sesión. */
export async function tokenActual(): Promise<string> {
    const token = await obtenerToken();
    if (!token) {
        router.replace('/login');
        throw new Error('Tu sesión terminó. Vuelve a iniciar sesión.');
    }
    return token;
}

/**
 * Convierte cualquier error en un mensaje entendible para mostrarlo y leerlo en voz alta.
 * Si la sesión expiró (401), además la cierra.
 */
export function mensajeDeError(e: unknown, porDefecto: string): string {
    if (e instanceof ApiError) {
        if (e.status === 401) {
            void cerrarSesion();
            return 'Tu sesión expiró. Vuelve a iniciar sesión.';
        }
        return e.message;
    }
    // fetch falla con TypeError cuando no hay conexión con el servidor
    if (e instanceof TypeError) return 'No pudimos conectarnos con el servidor. Revisa tu conexión e intenta de nuevo.';
    if (e instanceof Error && e.message) return e.message;
    return porDefecto;
}