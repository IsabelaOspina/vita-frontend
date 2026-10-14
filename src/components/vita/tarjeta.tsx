import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

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

    return (
        <View
            style={[
                styles.tarjeta,
                {
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
                    {extra}
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
});