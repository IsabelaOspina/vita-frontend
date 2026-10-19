import type { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { Espacio, Radio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';

import { Icono, type NombreIcono } from './icono';
import { Texto } from './texto';

type Props = {
    /** Título de la sección; el lector de pantalla lo anuncia como encabezado. */
    titulo?: string;
    icono?: NombreIcono;
    /** Algo a la derecha del título (por ejemplo un contador). */
    extra?: ReactNode;
    children: ReactNode;
};

/** Sección blanca con bordes redondeados (en alto contraste, negra con borde blanco). */
export function Tarjeta({ titulo, icono, extra, children }: Props) {
    const { colores, altoContraste } = useAccesibilidad();
    // En celulares angostos, menos relleno para que el contenido tenga más espacio
    const { width } = useWindowDimensions();
    const relleno = width < 380 ? Espacio.l : Espacio.xl;

    return (
        <View
            style={[
                styles.tarjeta,
                {
                    padding: relleno,
                    backgroundColor: colores.superficie,
                    borderColor: altoContraste ? colores.borde : 'transparent',
                },
                !altoContraste && styles.sombra,
            ]}>
            {titulo && (
                <View style={styles.encabezado}>
                    {icono && (
                        <View style={[styles.icono, { backgroundColor: colores.superficieSuave }]}>
                            <Icono nombre={icono} tamano={22} color={colores.primario} />
                        </View>
                    )}
                    <Texto variante="subtitulo" accessibilityRole="header" style={styles.titulo}>
                        {titulo}
                    </Texto>
                    {extra ? <View style={styles.extra}>{extra}</View> : null}
                </View>
            )}
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    tarjeta: {
        borderRadius: Radio.l,
        borderWidth: 2,
        padding: Espacio.xl,
        gap: Espacio.l,
        marginBottom: Espacio.l,
    },
    sombra: {
        boxShadow: '0px 12px 24px rgba(31, 58, 107, 0.08)',
    },
    encabezado: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Espacio.m,
    },
    icono: {
        width: 40,
        height: 40,
        borderRadius: Radio.total,
        alignItems: 'center',
        justifyContent: 'center',
    },
    titulo: {
        flex: 1,
    },
    // Lo de la derecha del título (por ejemplo "0 de 2") no se parte en varias líneas
    extra: {
        flexShrink: 0,
    },
});