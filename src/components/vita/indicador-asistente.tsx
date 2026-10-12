import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { AltoTactil, Espacio, Radio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';
import { useAsistente, type EstadoAsistente } from '@/context/asistente-context';

import { Icono } from './icono';
import { Texto } from './texto';

const TEXTO_POR_ESTADO: Record<Exclude<EstadoAsistente, 'apagado'>, string> = {
    esperando: 'Di «Oye VITA» o toca aquí',
    atento: 'Te escucho…',
    hablando: 'VITA está hablando · toca para interrumpir',
};

/**
 * Muestra en qué estado está el asistente de voz, arriba a la derecha de cada pantalla.
 *
 * Es un botón grande: tocarlo equivale a decir "Oye VITA" (útil si el micrófono no reconoce
 * bien la frase) y, si VITA está hablando, la interrumpe.
 */
export function IndicadorAsistente() {
    const { estado, prestarAtencion } = useAsistente();
    const { colores, altoContraste } = useAccesibilidad();

    if (estado === 'apagado') return null;

    const destacado = estado === 'atento';

    return (
        <View style={styles.fila}>
            <Pressable
                onPress={prestarAtencion}
                accessibilityRole="button"
                accessibilityLabel={estado === 'hablando' ? 'Interrumpir a VITA y darle una orden' : 'Hablar con VITA'}
                accessibilityHint={
                    Platform.OS === 'web'
                        ? 'Equivale a decir Oye VITA. Atajo de teclado: Alt más V'
                        : 'Equivale a decir Oye VITA'
                }
                style={({ pressed }) => [
                    styles.pastilla,
                    {
                        backgroundColor: destacado ? colores.primario : colores.superficie,
                        borderColor: colores.primario,
                    },
                    !altoContraste && styles.sombra,
                    pressed && { opacity: 0.8 },
                ]}>
                <View style={[styles.punto, { backgroundColor: destacado ? colores.sobrePrimario : colores.acento }]} />
                <Icono
                    nombre={estado === 'hablando' ? 'habla' : 'microfono'}
                    tamano={20}
                    color={destacado ? colores.sobrePrimario : colores.primario}
                />
                <Texto
                    variante="pequeno"
                    peso="700"
                    style={[styles.textoPastilla, { color: destacado ? colores.sobrePrimario : colores.texto }]}>
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
        minHeight: AltoTactil,
        maxWidth: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: Espacio.s,
        paddingVertical: Espacio.s,
        paddingHorizontal: Espacio.l,
        borderRadius: Radio.total,
        borderWidth: 2,
    },
    sombra: {
        boxShadow: '0px 4px 10px rgba(31, 58, 107, 0.12)',
    },
    textoPastilla: {
        flexShrink: 1,
    },
    punto: {
        width: 10,
        height: 10,
        borderRadius: Radio.total,
    },
});