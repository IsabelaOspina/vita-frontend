import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnchoMaximo, Espacio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';

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

    return (
        // overflow hidden: recorta las formas decorativas para que no generen scroll horizontal en web
        <View style={[styles.raiz, styles.recorte, { backgroundColor: colores.fondo }]}>
            {/* Formas decorativas; en alto contraste son transparentes */}
            <View pointerEvents="none" style={[styles.forma, styles.formaA, { backgroundColor: colores.decoracionA }]} />
            <View pointerEvents="none" style={[styles.forma, styles.formaB, { backgroundColor: colores.decoracionB }]} />

            <SafeAreaView style={styles.raiz} edges={['top', 'bottom']}>
                <KeyboardAvoidingView style={styles.raiz} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <ScrollView
                        contentContainerStyle={styles.scroll}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}>
                        <View style={styles.columna}>{children}</View>
                    </ScrollView>
                    {pie && <View style={[styles.columna, styles.pie]}>{pie}</View>}
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
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
        flexGrow: 0,
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