import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { Espacio, Radio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';
import type { AgrupacionTiempo } from '@/dto/AgrupacionTiempo';
import type { NivelIntensidad } from '@/dto/NivelIntensidad';
import type { SintomaEvolucionPunto } from '@/dto/SintomaEvolucionPunto';
import { deFechaLocal, diaCorto } from '@/utils/fechas';
import { decimal, nivelDe, nombreNivel } from '@/utils/sintomas';

import { coloresNivel } from './insignia-intensidad';
import { Texto } from './texto';

/** Alto de la zona de dibujo. */
const ALTO = 190;
/** Separación mínima entre puntos: si no caben, la gráfica se desliza de lado. */
const SEPARACION_MINIMA = 30;
/** Margen a los lados para que los puntos de las puntas no queden cortados. */
const MARGEN = 14;
const ANCHO_EJE = 22;

/**
 * La escala va de 1 a 10. Las franjas siguen los niveles del backend aplicados al promedio
 * redondeado: Leve hasta 3,5 · Moderada hasta 6,5 · Severa hasta 10.
 */
const FRANJAS: { nivel: NivelIntensidad; desde: number; hasta: number }[] = [
    { nivel: 'SEVERA', desde: 6.5, hasta: 10 },
    { nivel: 'MODERADA', desde: 3.5, hasta: 6.5 },
    { nivel: 'LEVE', desde: 1, hasta: 3.5 },
];

const RANGO_NIVEL: Record<NivelIntensidad, string> = { LEVE: '1–3', MODERADA: '4–6', SEVERA: '7–10' };

/** Posición vertical (desde arriba) de una intensidad entre 1 y 10. */
const yDe = (valor: number) => ((10 - Math.min(10, Math.max(1, valor))) / 9) * ALTO;

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

/** Fecha corta para el eje de abajo: "14 oct." o "oct. 2026" (la semana se nombra por su primer día). */
function etiquetaEje(punto: SintomaEvolucionPunto, agrupacion: AgrupacionTiempo): string {
    return agrupacion === 'MES' ? etiquetaPunto(punto, agrupacion) : diaCorto(punto.inicio);
}

/** Nivel del promedio de un periodo (igual que en el backend: se redondea y se clasifica). */
export const nivelDePunto = (punto: SintomaEvolucionPunto) => nivelDe(Math.round(punto.intensidadPromedio));

type Props = {
    puntos: SintomaEvolucionPunto[];
    agrupacion: AgrupacionTiempo;
    /** Lo que se lee de toda la gráfica (la frase del backend). */
    descripcion: string;
};

/**
 * Línea con la intensidad promedio de cada periodo, sobre franjas de fondo Leve / Moderada / Severa.
 * Cada punto lleva el color de su nivel y se puede tocar para ver su detalle. El primer y el último
 * punto muestran su número, para leer de un vistazo de dónde a dónde fue.
 */
export function GraficaEvolucion({ puntos, agrupacion, descripcion }: Props) {
    const { colores, altoContraste } = useAccesibilidad();
    const [elegido, setElegido] = useState<number | null>(null);
    const [anchoDisponible, setAnchoDisponible] = useState(0);
    const desplazable = useRef<ScrollView>(null);

    const n = puntos.length;
    // Ancho del dibujo: todo el espacio disponible, o más (y se desliza) si hay muchos puntos
    const anchoDibujo = Math.max(anchoDisponible, (n - 1) * SEPARACION_MINIMA + MARGEN * 2);
    const separacion = n > 1 ? (anchoDibujo - MARGEN * 2) / (n - 1) : 0;
    const xDe = (i: number) => (n > 1 ? MARGEN + i * separacion : anchoDibujo / 2);
    const radio = n > 20 ? 5 : 7;

    const coordenadas = puntos.map((p, i) => ({ x: xDe(i), y: yDe(p.intensidadPromedio) }));
    const punto = elegido !== null ? puntos[elegido] : null;

    const alMedir = (e: LayoutChangeEvent) => setAnchoDisponible(Math.max(0, e.nativeEvent.layout.width));

    // Etiquetas del eje de abajo: la primera, la del medio y la última
    const indicesEtiqueta = n <= 3 ? puntos.map((_, i) => i) : [0, Math.floor((n - 1) / 2), n - 1];

    return (
        <View style={styles.contenedor}>
            <View style={styles.grafica} accessibilityLabel={descripcion}>
                {/* Escala a la izquierda */}
                <View style={[styles.eje, { height: ALTO }]}>
                    {[10, 7, 4, 1].map((v) => (
                        <Texto key={v} variante="pequeno" color="textoTenue" style={[styles.numeroEje, { top: yDe(v) - 8 }]}>
                            {v}
                        </Texto>
                    ))}
                </View>

                <View style={styles.zona} onLayout={alMedir}>
                    {anchoDisponible > 0 && (
                        <ScrollView
                            ref={desplazable}
                            horizontal
                            showsHorizontalScrollIndicator={anchoDibujo > anchoDisponible}
                            // Empieza mostrando lo más reciente (a la derecha)
                            onContentSizeChange={() => desplazable.current?.scrollToEnd({ animated: false })}>
                            <View style={{ width: anchoDibujo }}>
                                <View style={{ height: ALTO }}>
                                    {/* Franjas de fondo con su nombre */}
                                    {FRANJAS.map((f) => {
                                        const { color, fondo } = coloresNivel(f.nivel, colores, altoContraste);
                                        return (
                                            <View
                                                key={f.nivel}
                                                pointerEvents="none"
                                                style={[
                                                    styles.franja,
                                                    {
                                                        top: yDe(f.hasta),
                                                        height: yDe(f.desde) - yDe(f.hasta),
                                                        backgroundColor: fondo,
                                                        borderColor: altoContraste ? color : 'transparent',
                                                    },
                                                ]}
                                            />
                                        );
                                    })}

                                    {/* Línea: un tramo recto entre cada par de puntos */}
                                    {coordenadas.slice(1).map((b, i) => {
                                        const a = coordenadas[i];
                                        const largo = Math.hypot(b.x - a.x, b.y - a.y);
                                        const angulo = Math.atan2(b.y - a.y, b.x - a.x);
                                        return (
                                            <View
                                                key={`tramo-${i}`}
                                                pointerEvents="none"
                                                style={[
                                                    styles.tramo,
                                                    {
                                                        width: largo,
                                                        left: (a.x + b.x) / 2 - largo / 2,
                                                        top: (a.y + b.y) / 2 - 1.5,
                                                        backgroundColor: colores.primario,
                                                        transform: [{ rotate: `${angulo}rad` }],
                                                    },
                                                ]}
                                            />
                                        );
                                    })}

                                    {/* Puntos (el área que se toca es más grande que el punto) */}
                                    {puntos.map((p, i) => {
                                        const { x, y } = coordenadas[i];
                                        const { color } = coloresNivel(nivelDePunto(p), colores, altoContraste);
                                        const activo = elegido === i;
                                        const conNumero = activo || i === 0 || i === n - 1;
                                        const toque = Math.max(radio * 2 + 8, Math.min(44, separacion));
                                        return (
                                            <Pressable
                                                key={p.inicio}
                                                onPress={() => setElegido(activo ? null : i)}
                                                accessibilityRole="button"
                                                accessibilityLabel={`${lecturaPunto(p, agrupacion)}, ${nombreNivel(nivelDePunto(p)).toLowerCase()}`}
                                                accessibilityState={{ selected: activo }}
                                                style={[styles.toque, { left: x - toque / 2, top: y - toque / 2, width: toque, height: toque }]}>
                                                {conNumero && (
                                                    <Texto
                                                        variante="pequeno"
                                                        peso="800"
                                                        style={[styles.numeroPunto, { bottom: toque / 2 + radio + 1 }]}>
                                                        {decimal(p.intensidadPromedio)}
                                                    </Texto>
                                                )}
                                                <View
                                                    style={{
                                                        width: (activo ? radio + 2 : radio) * 2,
                                                        height: (activo ? radio + 2 : radio) * 2,
                                                        borderRadius: radio + 2,
                                                        backgroundColor: color,
                                                        borderWidth: 2,
                                                        borderColor: activo ? colores.texto : colores.superficie,
                                                    }}
                                                />
                                            </Pressable>
                                        );
                                    })}
                                </View>

                                {/* Fechas debajo */}
                                <View style={styles.fechas}>
                                    {indicesEtiqueta.map((i) => (
                                        <Texto
                                            key={puntos[i].inicio}
                                            variante="pequeno"
                                            color="textoSecundario"
                                            numberOfLines={1}
                                            style={[styles.fecha, { left: Math.min(anchoDibujo - 80, Math.max(0, xDe(i) - 40)) }]}>
                                            {etiquetaEje(puntos[i], agrupacion)}
                                        </Texto>
                                    ))}
                                </View>
                            </View>
                        </ScrollView>
                    )}
                </View>
            </View>

            {/* Qué significa cada franja (con su rango, para no depender del color) */}
            <View style={styles.leyenda}>
                {[...FRANJAS].reverse().map((f) => {
                    const { color, fondo } = coloresNivel(f.nivel, colores, altoContraste);
                    return (
                        <View key={f.nivel} style={styles.itemLeyenda}>
                            <View style={[styles.muestra, { backgroundColor: fondo, borderColor: color }]} />
                            <Texto variante="pequeno" color="textoSecundario">
                                {nombreNivel(f.nivel)} {RANGO_NIVEL[f.nivel]}
                            </Texto>
                        </View>
                    );
                })}
            </View>

            {punto ? (
                <View style={[styles.detalle, { borderColor: colores.primario, backgroundColor: colores.superficieSuave }]} accessibilityLiveRegion="polite">
                    <Texto variante="etiqueta">{lecturaPunto(punto, agrupacion)}</Texto>
                    <Texto variante="pequeno" color="textoSecundario">
                        Nivel {nombreNivel(nivelDePunto(punto)).toLowerCase()} en promedio
                    </Texto>
                </View>
            ) : (
                <Texto variante="pequeno" color="textoSecundario">
                    Intensidad promedio de cada periodo. Toca un punto para ver su detalle.
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
        // Espacio arriba para el número del primer punto si está en 10
        paddingTop: Espacio.l,
    },
    eje: {
        width: ANCHO_EJE,
    },
    numeroEje: {
        position: 'absolute',
        right: 0,
        lineHeight: 16,
    },
    zona: {
        flex: 1,
    },
    franja: {
        position: 'absolute',
        left: 0,
        right: 0,
        borderWidth: 1,
    },
    leyenda: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Espacio.m,
    },
    itemLeyenda: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Espacio.xs,
    },
    muestra: {
        width: 14,
        height: 14,
        borderRadius: 4,
        borderWidth: 1.5,
    },
    tramo: {
        position: 'absolute',
        height: 3,
        borderRadius: 2,
    },
    toque: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
    },
    numeroPunto: {
        position: 'absolute',
        fontSize: 12,
    },
    fechas: {
        height: 22,
        marginTop: Espacio.xs,
    },
    fecha: {
        position: 'absolute',
        width: 80,
        textAlign: 'center',
        fontSize: 11,
    },
    detalle: {
        borderWidth: 1.5,
        borderRadius: Radio.m,
        padding: Espacio.m,
        gap: 2,
    },
});