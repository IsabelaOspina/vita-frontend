import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Espacio, Radio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';

import { Icono, type NombreIcono } from './icono';
import { Texto } from './texto';

type Props = {
    titulo: string;
    subtitulo?: string;
    /** Ícono grande a la izquierda del título (en las pantallas principales). */
    icono?: NombreIcono;
    /** Muestra el botón "Volver" (en las pantallas internas). */
    volver?: boolean;
};

/** Encabezado de las pantallas con sesión: botón para volver (opcional), ícono, título y subtítulo. */
export function Encabezado({ titulo, subtitulo, icono, volver }: Props) {
    const { colores } = useAccesibilidad();

    return (
        <View style={styles.contenedor}>
            {volver && (
                <Pressable
                    onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
                    accessibilityRole="button"
                    accessibilityLabel="Volver"
                    hitSlop={8}
                    style={({ pressed }) => [
                        styles.volver,
                        { backgroundColor: colores.superficie, borderColor: colores.borde },
                        pressed && { opacity: 0.7 },
                    ]}>
                    <Icono nombre="atras" tamano={22} color={colores.primario} />
                    <Texto variante="etiqueta" color="primario">
                        Volver
                    </Texto>
                </Pressable>
            )}

            <View style={styles.fila}>
                {icono && (
                    <View style={[styles.circulo, { backgroundColor: colores.primario }]}>
                        <Icono nombre={icono} tamano={28} color={colores.sobrePrimario} />
                    </View>
                )}
                <View style={styles.textos}>
                    <Texto variante="titulo" accessibilityRole="header">
                        {titulo}
                    </Texto>
                    {subtitulo ? (
                        <Texto variante="cuerpo" color="textoSecundario">
                            {subtitulo}
                        </Texto>
                    ) : null}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    contenedor: {
        gap: Espacio.l,
        marginBottom: Espacio.xl,
    },
    volver: {
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: Espacio.xs,
        minHeight: 48,
        paddingLeft: Espacio.s,
        paddingRight: Espacio.l,
        borderRadius: Radio.total,
        borderWidth: 1.5,
    },
    fila: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Espacio.l,
    },
    circulo: {
        width: 56,
        height: 56,
        borderRadius: Radio.total,
        alignItems: 'center',
        justifyContent: 'center',
    },
    textos: {
        flex: 1,
        gap: Espacio.xs,
    },
});