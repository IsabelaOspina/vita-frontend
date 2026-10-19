import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Espacio, Radio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';

import { BarraAccesibilidad } from './barra-accesibilidad';
import { Icono, type NombreIcono } from './icono';
import { Texto } from './texto';

type Props = {
    titulo: string;
    subtitulo?: string;
    /** Ícono grande a la izquierda del título (en las pantallas principales). */
    icono?: NombreIcono;
    /** Muestra el botón "Volver" (en las pantallas internas). */
    volver?: boolean;
    /** Qué hace "Volver" si no hay a dónde regresar (por ejemplo, al abrir el detalle directo desde un enlace). */
    alVolver?: () => void;
    /** Si es true, "Volver" siempre usa alVolver (por ejemplo, para regresar al paso anterior de un formulario). */
    alVolverPrimero?: boolean;
    /** Muestra el botón "Cerrar sesión" arriba a la derecha (en las pantallas principales). */
    alCerrarSesion?: () => void;
    /**
     * Muestra debajo del título la barra de accesibilidad (modo voz, alto contraste y tamaño de texto).
     * Va en todas las pantallas para que siempre esté a un toque; solo la pantalla de Ajustes la quita,
     * porque ya tiene la versión grande.
     */
    accesibilidad?: boolean;
};

/** Encabezado de las pantallas con sesión: botón para volver, ícono, título, subtítulo y la barra de accesibilidad. */
export function Encabezado({ titulo, subtitulo, icono, volver, alVolver, alVolverPrimero, alCerrarSesion, accesibilidad = true }: Props) {
    const { colores } = useAccesibilidad();

    return (
        <View style={styles.contenedor}>
            {(volver || alCerrarSesion) && (
                <View style={styles.barra}>
                    {volver ? (
                        <Pressable
                            onPress={() => (alVolverPrimero && alVolver ? alVolver() : router.canGoBack() ? router.back() : alVolver ? alVolver() : router.replace('/'))}
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
                    ) : (
                        <View />
                    )}
                    {alCerrarSesion && (
                        <Pressable
                            onPress={alCerrarSesion}
                            accessibilityRole="button"
                            accessibilityLabel="Cerrar sesión"
                            hitSlop={8}
                            style={({ pressed }) => [
                                styles.boton,
                                { backgroundColor: colores.superficie, borderColor: colores.primario },
                                pressed && { opacity: 0.7 },
                            ]}>
                            <Texto variante="etiqueta" color="primario" peso="700">
                                Cerrar sesión
                            </Texto>
                            <Icono nombre="salir" tamano={20} color={colores.primario} />
                        </Pressable>
                    )}
                </View>
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

            {accesibilidad && <BarraAccesibilidad compacta />}
        </View>
    );
}

const styles = StyleSheet.create({
    contenedor: {
        gap: Espacio.l,
        marginBottom: Espacio.xl,
    },
    barra: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: Espacio.m,
    },
    boton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Espacio.xs,
        minHeight: 48,
        paddingHorizontal: Espacio.l,
        borderRadius: Radio.total,
        borderWidth: 1.5,
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