import { Pressable, StyleSheet, View } from 'react-native';

import { Espacio, Radio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';
import { useAsistente, type EstadoAsistente } from '@/context/asistente-context';

import { Icono } from './icono';
import { Texto } from './texto';

const TEXTO_POR_ESTADO: Record<Exclude<EstadoAsistente, 'apagado'>, string> = {
    esperando: 'Di «Oye VITA»',
    atento: 'Te escucho…',
    hablando: 'VITA está hablando…',
};

/**
 * Muestra en qué estado está el asistente de voz, arriba a la derecha de cada pantalla.
 * Tocarlo equivale a decir "Oye VITA" (útil si el micrófono no reconoce bien la frase).
 */
export function IndicadorAsistente() {
    const { estado, prestarAtencion } = useAsistente();
    const { colores } = useAccesibilidad();

    if (estado === 'apagado') return null;

    const destacado = estado === 'atento';

    return (
        <View style={styles.fila}>
            <Pressable
                onPress={prestarAtencion}
                disabled={estado !== 'esperando'}
                accessibilityRole="button"
                accessibilityLabel={`Asistente de voz: ${TEXTO_POR_ESTADO[estado]}`}
                accessibilityHint="Toca para darle una orden al asistente sin decir Oye VITA"
                accessibilityLiveRegion="polite"
                style={({ pressed }) => [
                    styles.pastilla,
                    {
                        backgroundColor: destacado ? colores.primario : colores.superficie,
                        borderColor: colores.primario,
                        shadowColor: colores.sombra,
                    },
                    pressed && { opacity: 0.8 },
                ]}>
                <View style={[styles.punto, { backgroundColor: destacado ? colores.sobrePrimario : colores.acento }]} />
                <Icono
                    nombre={estado === 'hablando' ? 'habla' : 'microfono'}
                    tamano={18}
                    color={destacado ? colores.sobrePrimario : colores.primario}
                />
                <Texto variante="pequeno" peso="700" style={{ color: destacado ? colores.sobrePrimario : colores.texto }}>
                    {TEXTO_POR_ESTADO[estado]}
                </Texto>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    fila: {
        alignItems: 'flex-end',
        marginBottom: Espacio.m,
    },
    pastilla: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Espacio.s,
        paddingVertical: Espacio.s,
        paddingHorizontal: Espacio.m,
        borderRadius: Radio.total,
        borderWidth: 1.5,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
        elevation: 4,
    },
    punto: {
        width: 8,
        height: 8,
        borderRadius: Radio.total,
    },
});