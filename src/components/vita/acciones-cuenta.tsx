import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Espacio } from '@/constants/vita-theme';
import type { AccionVoz } from '@/utils/comandos-voz';
import { cerrarSesion } from '@/utils/sesion';

import { Boton } from './boton';

/** Órdenes de voz para cambiar la contraseña y cerrar sesión (sirven en todas las pantallas con sesión). */
export function accionesDeCuentaVoz(anunciar: (mensaje: string) => void): AccionVoz[] {
    return [
        {
            frases: ['cambiar contrasena', 'cambiar mi contrasena', 'cambiar la contrasena', 'cambia mi contrasena', 'cambia la contrasena'],
            etiqueta: 'cambiar la contraseña',
            ejecutar: () => router.push('/cambiar-contrasena'),
        },
        {
            frases: ['cerrar sesion', 'cierra sesion', 'cierra la sesion', 'cerrar la sesion', 'salir'],
            etiqueta: 'cerrar sesión',
            ejecutar: () => {
                anunciar('Cerraste sesión');
                void cerrarSesion();
            },
        },
    ];
}

/** Botones "Cambiar contraseña" y "Cerrar sesión", al final de las pantallas principales. */
export function AccionesCuenta({ anunciar }: { anunciar: (mensaje: string) => void }) {
    return (
        <View style={styles.contenedor}>
            <Boton titulo="Cambiar contraseña" icono="llave" variante="secundario" onPress={() => router.push('/cambiar-contrasena')} />
            <Boton
                titulo="Cerrar sesión"
                icono="salir"
                variante="secundario"
                onPress={() => {
                    anunciar('Cerraste sesión');
                    void cerrarSesion();
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    contenedor: {
        gap: Espacio.m,
        marginBottom: Espacio.xl,
    },
});