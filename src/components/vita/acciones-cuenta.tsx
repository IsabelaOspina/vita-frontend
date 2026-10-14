import { router } from 'expo-router';

import type { Rol } from '@/dto/Rol';
import type { AccionVoz } from '@/utils/comandos-voz';
import { cerrarSesion, rutasDe } from '@/utils/sesion';

/** Cierra la sesión avisando en voz alta (botón "Cerrar sesión" de arriba a la derecha y orden de voz). */
export function salir(anunciar: (mensaje: string) => void) {
    anunciar('Cerraste sesión');
    void cerrarSesion();
}

/**
 * Órdenes de voz que sirven en todas las pantallas con sesión: moverse entre las pestañas,
 * cambiar la contraseña y cerrar sesión. Cada pantalla las agrega al final de sus acciones.
 */
export function accionesComunesVoz(rol: Rol, anunciar: (mensaje: string) => void): AccionVoz[] {
    const rutas = rutasDe(rol);
    return [
        // Solo el paciente tiene la pestaña "Síntomas"
        ...(rol === 'USUARIO'
            ? [
                {
                    frases: ['ve a sintomas', 'ir a sintomas', 'abre sintomas', 've a mis sintomas', 'ir a mis sintomas', 'abre mis sintomas', 'pestana sintomas'],
                    etiqueta: 'ir a mis síntomas',
                    ejecutar: () => router.navigate('/paciente/sintomas'),
                },
            ]
            : []),
        {
            frases: ['ve a mi cuenta', 'ir a mi cuenta', 'abre mi cuenta', 'mi cuenta', 'mis datos', 'mi perfil', 'mi informacion'],
            etiqueta: 'ir a mi cuenta',
            ejecutar: () => router.navigate(rutas.miCuenta),
        },
        {
            frases: ['ve a accesibilidad', 'ir a accesibilidad', 'abre accesibilidad', 'accesibilidad', 'ajustes', 'configuracion'],
            etiqueta: 'ir a accesibilidad',
            ejecutar: () => router.navigate(rutas.accesibilidad),
        },
        {
            frases: ['ve al inicio', 'ir al inicio', 'volver al inicio', 'pantalla principal', 'inicio'],
            etiqueta: 'ir al inicio',
            ejecutar: () => router.navigate(rutas.inicio),
        },
        {
            frases: ['cambiar contrasena', 'cambiar mi contrasena', 'cambiar la contrasena', 'cambia mi contrasena', 'cambia la contrasena'],
            etiqueta: 'cambiar la contraseña',
            ejecutar: () => router.push('/cambiar-contrasena'),
        },
        {
            frases: ['cerrar sesion', 'cierra sesion', 'cierra la sesion', 'cerrar la sesion', 'salir'],
            etiqueta: 'cerrar sesión',
            ejecutar: () => salir(anunciar),
        },
    ];
}