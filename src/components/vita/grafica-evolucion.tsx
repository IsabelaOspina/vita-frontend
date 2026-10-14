import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Espacio, Radio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';
import type { AgrupacionTiempo } from '@/dto/AgrupacionTiempo';
import type { SintomaEvolucionPunto } from '@/dto/SintomaEvolucionPunto';
import { deFechaLocal, diaCorto } from '@/utils/fechas';
import { decimal, nivelDe, nombreNivel } from '@/utils/sintomas';

import { coloresNivel } from './insignia-intensidad';
import { Texto } from './texto';

const ALTO = 160;
const ANCHO_BARRA = 28;

/** Etiqueta corta de un periodo: "14 oct." (día), "sem. 6 oct." (semana) u "oct. 2026" (mes). */
export function etiquetaPunto(punto: SintomaEvolucionPunto, agrupacion: AgrupacionTiempo): string {
    if (agrupacion === 'MES') {
        return deFechaLocal(punto.inicio).toLocaleDateString('es-CO', { month: 'short', year: 'numeric' });
    }
    if (agrupacion === 'SEMANA') return `sem. ${diaCorto(punto.inicio)}`;
    return diaCorto(punto.inicio);
}

/** Cómo se lee un periodo en voz alta: "14 oct.: 2 registros, promedio 4,5, máximo 6". */
export function lecturaPunto(punto: SintomaEvolucionPunto, agrupacion: AgrupacionTiempo): string {
    const registros = punto.cantidad === 1 ? '1 registro' : `${punto.cantidad} registros`;
    return `${etiquetaPunto(punto, agrupacion)}: ${registros}, promedio ${decimal(punto.intensidadPromedio)}, máximo ${punto.intensidadMaxima}`;
}

type Props = {
    puntos: SintomaEvolucionPunto[];
    agrupacion: AgrupacionTiempo;
    /** Lo que se lee de toda la gráfica (la frase del backend). */
    descripcion: string;
};

/**
 * Barras con la intensidad promedio de cada periodo (escala de 0 a 10). El color de cada barra
 * es el de su nivel, y siempre va con el número encima. Al tocar una barra se ve su detalle.
 */
export function GraficaEvolucion({ puntos, agrupacion, descripcion }: Props) {
    const { colores, altoContraste } = useAccesibilidad();
    const [elegido, setElegido] = useState<number | null>(null);
    const desplazable = useRef<ScrollView>(null);
    const punto = elegido !== null ? puntos[elegido] : null;

    return (
        <View style={styles.contenedor}>
            <View style={styles.grafica} accessible={false} accessibilityLabel={descripcion}>
                {/* Escala: 10, 5 y 0, con líneas tenues */}
                <View style={[styles.eje, { height: ALTO }]}>
                    {[10, 5, 0].map((n) => (
                        <Texto key={n} variante="pequeno" color="textoTenue" style={[styles.numeroEje, { top: ((10 - n) / 10) * ALTO - 8 }]}>
                            {n}
                        </Texto>
                    ))}
                </View>
                <ScrollView
                    ref={desplazable}
                    horizontal
                    showsHorizontalScrollIndicator
                    contentContainerStyle={styles.desplazable}
                    // Empieza mostrando lo más reciente (a la derecha)
                    onContentSizeChange={() => desplazable.current?.scrollToEnd({ animated: false })}>
                    <View style={[styles.area, { height: ALTO }]}>
                        {[0, 0.5, 1].map((f) => (
                            <View key={f} style={[styles.linea, { top: f * ALTO, borderColor: colores.borde }]} />
                        ))}
                        <View style={styles.barras}>
                            {puntos.map((p, i) => {
                                const { color } = coloresNivel(nivelDe(Math.round(p.intensidadPromedio)), colores, altoContraste);
                                const alto = Math.max(4, (p.intensidadPromedio / 10) * ALTO);
                                const activo = elegido === i;
                                return (
                                    <Pressable
                                        key={p.inicio}
                                        onPress={() => setElegido(activo ? null : i)}
                                        accessibilityRole="button"
                                        accessibilityLabel={lecturaPunto(p, agrupacion)}
                                        accessibilityState={{ selected: activo }}
                                        // El área que se toca es más grande que la barra
                                        style={styles.columna}>
                                        <Texto variante="pequeno" peso="700" style={styles.valor}>
                                            {decimal(p.intensidadPromedio)}
                                        </Texto>
                                        <View
                                            style={[
                                                styles.barra,
                                                {
                                                    height: alto,
                                                    backgroundColor: color,
                                                    borderColor: activo ? colores.texto : 'transparent',
                                                },
                                            ]}
                                        />
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>
                    <View style={styles.etiquetas}>
                        {puntos.map((p) => (
                            <Texto key={p.inicio} variante="pequeno" color="textoSecundario" centrado style={styles.etiqueta} numberOfLines={2}>
                                {etiquetaPunto(p, agrupacion)}
                            </Texto>
                        ))}
                    </View>
                </ScrollView>
            </View>

            {punto ? (
                <View style={[styles.detalle, { borderColor: colores.primario, backgroundColor: colores.superficieSuave }]}>
                    <Texto variante="etiqueta">{lecturaPunto(punto, agrupacion)}</Texto>
                    <Texto variante="pequeno" color="textoSecundario">
                        Nivel {nombreNivel(nivelDe(Math.round(punto.intensidadPromedio))).toLowerCase()} en promedio
                    </Texto>
                </View>
            ) : (
                <Texto variante="pequeno" color="textoSecundario">
                    Intensidad promedio de cada periodo, del 0 al 10. Toca una barra para ver su detalle.
                </Texto>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    contenedor: {
        gap: Espacio.m,
    },
    grafica: {
        flexDirection: 'row',
        gap: Espacio.xs,
    },
    eje: {
        width: 20,
        marginTop: 22,
    },
    numeroEje: {
        position: 'absolute',
        right: 0,
        lineHeight: 16,
    },
    desplazable: {
        flexGrow: 1,
        flexDirection: 'column',
    },
    area: {
        marginTop: 22,
        justifyContent: 'flex-end',
    },
    linea: {
        position: 'absolute',
        left: 0,
        right: 0,
        borderTopWidth: 1,
    },
    barras: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: Espacio.s,
        paddingHorizontal: Espacio.xs,
        height: '100%',
    },
    columna: {
        width: ANCHO_BARRA + Espacio.s,
        alignItems: 'center',
        justifyContent: 'flex-end',
        height: '100%',
        overflow: 'visible',
    },
    valor: {
        position: 'relative',
        marginBottom: 2,
    },
    barra: {
        width: ANCHO_BARRA,
        borderTopLeftRadius: 4,
        borderTopRightRadius: 4,
        borderWidth: 2,
        borderBottomWidth: 0,
    },
    etiquetas: {
        flexDirection: 'row',
        gap: Espacio.s,
        paddingHorizontal: Espacio.xs,
        marginTop: Espacio.xs,
    },
    etiqueta: {
        width: ANCHO_BARRA + Espacio.s,
        fontSize: 11,
        lineHeight: 14,
    },
    detalle: {
        borderWidth: 1.5,
        borderRadius: Radio.m,
        padding: Espacio.m,
        gap: 2,
    },
});