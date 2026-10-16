import { Pressable, StyleSheet, View } from 'react-native';

import { Espacio, Radio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';
import type { TipoActividad } from '@/dto/TipoActividad';
import { aDia } from '@/utils/fechas';
import { diaLargo } from '@/utils/salud';

import { coloresTipoActividad } from './elemento-actividad';
import { Icono } from './icono';
import { Texto } from './texto';

const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

type Props = {
    /** Cualquier día del mes que se muestra. */
    mes: Date;
    /** Tipos de actividad de cada día ("2026-10-16" → ["CITA_MEDICA"]). */
    marcas: Record<string, TipoActividad[]>;
    seleccionado: Date;
    onElegir: (dia: Date) => void;
    onCambiarMes: (delta: number) => void;
};

/** Calendario de un mes: los días con actividades llevan puntos del color de su tipo. Hoy va resaltado. */
export function CalendarioMes({ mes, marcas, seleccionado, onElegir, onCambiarMes }: Props) {
    const { colores, altoContraste } = useAccesibilidad();
    const anio = mes.getFullYear();
    const m = mes.getMonth();
    const primero = new Date(anio, m, 1);
    const diasEnMes = new Date(anio, m + 1, 0).getDate();
    const vacios = (primero.getDay() + 6) % 7;
    const hoy = aDia(new Date());
    const elegido = aDia(seleccionado);
    const nombreMes = primero.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });

    const celdas: (Date | null)[] = [...Array(vacios).fill(null), ...Array.from({ length: diasEnMes }, (_, i) => new Date(anio, m, i + 1))];
    while (celdas.length % 7) celdas.push(null);

    return (
        <View style={styles.contenedor}>
            <View style={styles.cabecera}>
                <Pressable
                    onPress={() => onCambiarMes(-1)}
                    accessibilityRole="button"
                    accessibilityLabel="Mes anterior"
                    hitSlop={8}
                    style={[styles.flecha, { borderColor: colores.borde, backgroundColor: colores.superficie }]}>
                    <Icono nombre="atras" tamano={24} color={colores.primario} />
                </Pressable>
                <Texto variante="subtitulo" peso="800" accessibilityRole="header">
                    {nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1)}
                </Texto>
                <Pressable
                    onPress={() => onCambiarMes(1)}
                    accessibilityRole="button"
                    accessibilityLabel="Mes siguiente"
                    hitSlop={8}
                    style={[styles.flecha, { borderColor: colores.borde, backgroundColor: colores.superficie }]}>
                    <Icono nombre="siguiente" tamano={24} color={colores.primario} />
                </Pressable>
            </View>

            <View style={styles.semana} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                {DIAS.map((d, i) => (
                    <Texto key={i} variante="pequeno" peso="700" color="textoTenue" centrado style={styles.celda}>
                        {d}
                    </Texto>
                ))}
            </View>

            <View style={styles.grilla}>
                {celdas.map((dia, i) => {
                    if (!dia) return <View key={`v${i}`} style={styles.celda} />;
                    const clave = aDia(dia);
                    const tipos = marcas[clave] ?? [];
                    const esHoy = clave === hoy;
                    const esElegido = clave === elegido;
                    return (
                        <Pressable
                            key={clave}
                            onPress={() => onElegir(dia)}
                            accessibilityRole="button"
                            accessibilityLabel={`${esHoy ? 'Hoy, ' : ''}${diaLargo(dia)}${tipos.length ? `, ${tipos.length === 1 ? '1 actividad' : `${tipos.length} actividades`}` : ''}`}
                            accessibilityState={{ selected: esElegido }}
                            style={[
                                styles.celda,
                                styles.dia,
                                {
                                    backgroundColor: esHoy ? colores.primario : esElegido ? colores.superficieSuave : colores.superficie,
                                    borderColor: esElegido ? colores.primario : altoContraste ? colores.borde : 'transparent',
                                    borderWidth: esElegido ? 2.5 : 1,
                                },
                            ]}>
                            <Texto variante="pequeno" peso={esHoy || esElegido ? '800' : '600'} color={esHoy ? 'sobrePrimario' : 'texto'}>
                                {dia.getDate()}
                            </Texto>
                            <View style={styles.puntos}>
                                {tipos.slice(0, 3).map((t, k) => (
                                    <View
                                        key={k}
                                        style={[
                                            styles.punto,
                                            { backgroundColor: esHoy ? colores.sobrePrimario : coloresTipoActividad(t, colores, altoContraste).color },
                                        ]}
                                    />
                                ))}
                            </View>
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    contenedor: {
        gap: Espacio.s,
    },
    cabecera: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    flecha: {
        width: 44,
        height: 44,
        borderRadius: Radio.total,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    semana: {
        flexDirection: 'row',
    },
    grilla: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    celda: {
        width: `${100 / 7}%`,
    },
    dia: {
        height: 48,
        borderRadius: Radio.s,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        // Pequeño espacio entre días sin romper la grilla de 7 columnas
        transform: [{ scale: 0.94 }],
    },
    puntos: {
        flexDirection: 'row',
        gap: 3,
        height: 7,
    },
    punto: {
        width: 7,
        height: 7,
        borderRadius: 4,
    },
});