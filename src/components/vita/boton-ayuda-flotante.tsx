import { usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet } from 'react-native';

import { Espacio, Radio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';
import { useAsistente } from '@/context/asistente-context';

import { Icono } from './icono';
import { Texto } from './texto';

/**
 * Pantallas del paciente sin el botón flotante: Inicio ya tiene el botón grande "Pedir ayuda",
 * y en las de emergencia no hace falta.
 */
const SIN_BOTON = ['/paciente', '/paciente/emergencia', '/paciente/contacto-emergencia'];

/** Espacio extra al final del contenido para que el botón flotante no tape lo último de la pantalla. */
export const ESPACIO_AYUDA_FLOTANTE = 84;

/** ¿Se muestra el botón flotante en esta pantalla? (solo en las del paciente, y no con el teclado abierto). */
export function useAyudaFlotanteVisible(): boolean {
    const ruta = usePathname();
    const [teclado, setTeclado] = useState(false);

    useEffect(() => {
        // En el celular el teclado tapa la parte de abajo: mientras se escribe, el botón se esconde
        if (Platform.OS === 'web') return;
        const abierto = Keyboard.addListener('keyboardDidShow', () => setTeclado(true));
        const cerrado = Keyboard.addListener('keyboardDidHide', () => setTeclado(false));
        return () => {
            abierto.remove();
            cerrado.remove();
        };
    }, []);

    return ruta.startsWith('/paciente') && !SIN_BOTON.includes(ruta) && !teclado;
}

/**
 * Botón rojo "Pedir ayuda" que flota abajo a la derecha en todas las pantallas del paciente.
 * Activa el modo voz, abre "Pedir ayuda" y VITA pregunta qué pasó. La alerta solo se envía
 * cuando la persona dice el tipo de emergencia (o lo toca y confirma).
 */
export function BotonAyudaFlotante({ visible }: { visible: boolean }) {
    const { colores } = useAccesibilidad();
    const { pedirAyuda } = useAsistente();

    if (!visible) return null;

    return (
        <Pressable
            onPress={() => pedirAyuda()}
            accessibilityRole="button"
            accessibilityLabel="Pedir ayuda de emergencia"
            accessibilityHint="Activa el modo voz y abre Pedir ayuda. VITA te preguntará qué pasó."
            hitSlop={6}
            style={({ pressed }) => [
                styles.boton,
                { backgroundColor: colores.error, borderColor: colores.sobrePrimario, opacity: pressed ? 0.85 : 1 },
            ]}
        >
            <Icono nombre="emergencia" tamano={26} color={colores.sobrePrimario} />
            <Texto variante="cuerpo" peso="800" style={{ color: colores.sobrePrimario }}>
                Pedir ayuda
            </Texto>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    boton: {
        position: 'absolute',
        right: Espacio.l,
        bottom: Espacio.l,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Espacio.s,
        minHeight: 60,
        paddingHorizontal: Espacio.l,
        borderRadius: Radio.total,
        borderWidth: 2,
        // Sombra para que se distinga del contenido que pasa por debajo
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
        elevation: 6,
    },
});