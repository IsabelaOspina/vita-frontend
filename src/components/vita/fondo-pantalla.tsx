import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnchoMaximo, Espacio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';

import { IndicadorAsistente } from './indicador-asistente';

type Props = {
    children: ReactNode;
    /** Contenido fijo abajo (por ejemplo la barra de accesibilidad o un botón). */
    pie?: ReactNode;
};

/**
 * Contenedor de pantalla: fondo con formas suaves, área segura,
 * desplazamiento y ajuste cuando aparece el teclado.
 */
export function FondoPantalla({ children, pie }: Props) {
    const { colores } = useAccesibilidad();
    // En celulares angostos (o con letra grande) los márgenes laterales son más pequeños, para que quepa el texto
    const { width } = useWindowDimensions();
    const margen = width < 380 ? Espacio.l : Espacio.xl;

    return (
        // overflow hidden: recorta las formas decorativas para que no generen scroll horizontal en web
        <View style={[styles.raiz, styles.recorte, { backgroundColor: colores.fondo }]}>
            {/* Formas decorativas; en alto contraste son transparentes */}
            <View style={[styles.forma, styles.formaA, styles.sinToques, { backgroundColor: colores.decoracionA }]} />
            <View style={[styles.forma, styles.formaB, styles.sinToques, { backgroundColor: colores.decoracionB }]} />

            <SafeAreaView style={styles.raiz} edges={['top', 'bottom']}>
                <KeyboardAvoidingView style={styles.raiz} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <ScrollView
                        contentContainerStyle={[styles.scroll, { paddingHorizontal: margen }]}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}>
                        <View style={styles.columna}>
                            {/* Estado del asistente "Oye VITA" (solo se ve con el modo voz activo) */}
                            <IndicadorAsistente />
                            {children}
                        </View>
                    </ScrollView>
                    {pie && (
                        <View style={[styles.pie, { paddingHorizontal: margen }]}>
                            <View style={styles.columna}>{pie}</View>
                        </View>
                    )}
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    // Las formas decorativas no reciben toques
    sinToques: {
        pointerEvents: 'none',
    },
    raiz: {
        flex: 1,
    },
    recorte: {
        overflow: 'hidden',
    },
    scroll: {
        flexGrow: 1,
        paddingHorizontal: Espacio.xl,
        paddingVertical: Espacio.xl,
    },
    columna: {
        width: '100%',
        maxWidth: AnchoMaximo,
        alignSelf: 'center',
        flexGrow: 1,
    },
    pie: {
        paddingHorizontal: Espacio.xl,
        paddingBottom: Espacio.l,
        paddingTop: Espacio.s,
    },
    forma: {
        position: 'absolute',
        borderRadius: 999,
    },
    formaA: {
        width: 340,
        height: 340,
        top: -170,
        right: -120,
        opacity: 0.9,
    },
    formaB: {
        width: 220,
        height: 220,
        top: 60,
        left: -150,
        opacity: 0.8,
    },
});