import { Pressable, StyleSheet, View } from 'react-native';

import { Espacio, Radio, type Paleta } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';
import type { ActividadSaludResponse } from '@/dto/ActividadSaludResponse';
import type { TipoActividad } from '@/dto/TipoActividad';
import { deFechaLocal, horaCorta } from '@/utils/fechas';
import { cuandoActividad, nombreEstadoActividad, nombreTipoActividad } from '@/utils/salud';

import { Icono } from './icono';
import { Texto } from './texto';

const TERAPIA = { normal: { color: '#6A3FC9', fondo: '#EFE8FF' }, altoContraste: { color: '#D9C2FF', fondo: '#000000' } };

/** Color de cada tipo de actividad: cita en azul, terapia en violeta, otra en gris. Siempre va con su nombre. */
export function coloresTipoActividad(tipo: TipoActividad, colores: Paleta, altoContraste: boolean) {
    if (tipo === 'CITA_MEDICA') return { color: colores.primario, fondo: colores.calendario.fondo };
    if (tipo === 'TERAPIA') return altoContraste ? TERAPIA.altoContraste : TERAPIA.normal;
    return { color: colores.textoSecundario, fondo: colores.superficieSuave };
}

type Props = {
    actividad: ActividadSaludResponse;
    /** Muestra el día además de la hora (en "Próximas citas"). */
    conDia?: boolean;
    onPress: () => void;
};

/** Una actividad del calendario: tipo, nombre, hora, lugar y estado. Se toca para ver el detalle. */
export function ElementoActividad({ actividad, conDia, onPress }: Props) {
    const { colores, altoContraste } = useAccesibilidad();
    const { color, fondo } = coloresTipoActividad(actividad.tipo, colores, altoContraste);
    const cuando = conDia ? cuandoActividad(actividad.fechaHora) : horaCorta(deFechaLocal(actividad.fechaHora));
    const terminada = actividad.estado !== 'PENDIENTE';

    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={`${nombreTipoActividad(actividad.tipo)}: ${actividad.nombre}, ${cuando}${actividad.ubicacion ? `, en ${actividad.ubicacion}` : ''}${terminada ? `, ${nombreEstadoActividad(actividad.estado).toLowerCase()}` : ''}`}
            accessibilityHint="Abre el detalle de la actividad"
            style={({ pressed }) => [
                styles.contenedor,
                {
                    borderColor: colores.borde,
                    borderLeftColor: color,
                    backgroundColor: pressed ? colores.superficieSuave : colores.superficie,
                    opacity: terminada ? 0.75 : 1,
                },
            ]}>
            <View style={styles.textos}>
                <View style={styles.etiquetas}>
                    <View style={[styles.chip, { backgroundColor: fondo, borderColor: color, borderWidth: altoContraste ? 1.5 : 0 }]}>
                        <Texto variante="pequeno" peso="700" style={{ color }}>
                            {nombreTipoActividad(actividad.tipo)}
                        </Texto>
                    </View>
                    {terminada && (
                        <View
                            style={[
                                styles.chip,
                                { backgroundColor: actividad.estado === 'COMPLETADA' ? colores.exitoFondo : colores.errorFondo },
                            ]}>
                            <Texto
                                variante="pequeno"
                                peso="700"
                                style={{ color: actividad.estado === 'COMPLETADA' ? colores.exito : colores.error }}>
                                {actividad.estado === 'COMPLETADA' ? '✓ ' : ''}
                                {nombreEstadoActividad(actividad.estado)}
                            </Texto>
                        </View>
                    )}
                </View>
                <Texto variante="cuerpo" peso="700">
                    {actividad.nombre}
                </Texto>
                <Texto variante="pequeno" color="textoSecundario">
                    {cuando}
                    {actividad.ubicacion ? ` · ${actividad.ubicacion}` : ''}
                </Texto>
            </View>
            <Icono nombre="siguiente" tamano={22} color={colores.textoTenue} />
        </Pressable>
    );
}

const styles = StyleSheet.create({
    contenedor: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Espacio.s,
        padding: Espacio.m,
        borderWidth: 1.5,
        borderLeftWidth: 6,
        borderRadius: Radio.m,
    },
    textos: {
        flex: 1,
        minWidth: 0,
        gap: 3,
    },
    etiquetas: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Espacio.xs,
    },
    chip: {
        borderRadius: Radio.s,
        paddingHorizontal: Espacio.s,
        paddingVertical: 2,
    },
});