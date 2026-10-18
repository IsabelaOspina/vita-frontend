import { router } from 'expo-router';

import type { Rol } from '@/dto/Rol';
import type { AccionVoz } from '@/utils/comandos-voz';
import { cerrarSesion, rutasDe } from '@/utils/sesion';

import { cancelarRecordatoriosDelCelular } from './vigilante-recordatorios';

/** Cierra la sesión avisando en voz alta (botón "Cerrar sesión" de arriba a la derecha y orden de voz). */
export function salir(anunciar: (mensaje: string) => void) {
    anunciar('Cerraste sesión');
    // Los recordatorios programados en el celular son de esta cuenta: no deben seguir llegando
    void cancelarRecordatoriosDelCelular();
    void cerrarSesion();
}

/**
 * Órdenes de voz que sirven en todas las pantallas con sesión: moverse entre las pestañas,
 * cambiar la contraseña y cerrar sesión. Cada pantalla las agrega al final de sus acciones.
 */
export function accionesComunesVoz(rol: Rol, anunciar: (mensaje: string) => void): AccionVoz[] {
    const rutas = rutasDe(rol);
    return [
        // Solo el paciente tiene "Mi salud": agenda, medicamentos y síntomas
        ...(rol === 'USUARIO'
            ? [
                {
                    frases: ['ve a mi salud', 'ir a mi salud', 'abre mi salud', 'mi salud', 'pestana mi salud'],
                    etiqueta: 'ir a mi salud',
                    ejecutar: () => router.navigate('/paciente/salud'),
                },
                {
                    frases: ['que tengo hoy', 'que hay hoy', 'lo de hoy', 'ver lo de hoy', 'mis pendientes de hoy', 've a hoy'],
                    etiqueta: 'ver lo de hoy',
                    ejecutar: () => router.navigate('/paciente/salud/hoy'),
                },
                {
                    frases: ['ve a la agenda', 'ir a la agenda', 'abre la agenda', 'mi agenda', 'agenda', 'mis citas', 'calendario', 'mi calendario'],
                    etiqueta: 'ir a la agenda',
                    ejecutar: () => router.navigate('/paciente/salud/agenda'),
                },
                {
                    frases: ['ve a medicamentos', 'ir a medicamentos', 'abre medicamentos', 'mis medicamentos', 'medicamentos', 'mis medicinas', 'medicinas'],
                    etiqueta: 'ir a mis medicamentos',
                    ejecutar: () => router.navigate('/paciente/salud/medicamentos'),
                },
                {
                    frases: ['ve a recomendaciones', 'ir a recomendaciones', 'abre recomendaciones', 'mis recomendaciones', 'recomendaciones', 'que me recomendaron'],
                    etiqueta: 'ir a mis recomendaciones',
                    ejecutar: () => router.navigate('/paciente/salud/recomendaciones'),
                },
                {
                    frases: ['ve a sintomas', 'ir a sintomas', 'abre sintomas', 've a mis sintomas', 'ir a mis sintomas', 'abre mis sintomas'],
                    etiqueta: 'ir a mis síntomas',
                    ejecutar: () => router.navigate('/paciente/salud/sintomas'),
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