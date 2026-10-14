import { StyleSheet, View } from 'react-native';

import { Radio, type Paleta } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';
import type { NivelIntensidad } from '@/dto/NivelIntensidad';
import { nivelDe, nombreNivel } from '@/utils/sintomas';

import { Texto } from './texto';

/** Ámbar de la intensidad moderada (el tema no tiene un color de advertencia). */
const MODERADA = { normal: { color: '#8A5300', fondo: '#FFF1D6' }, altoContraste: { color: '#FFD27A', fondo: '#000000' } };

/**
 * Color de cada nivel: verde leve, ámbar moderada y rojo severa. Nunca se usa solo: siempre
 * va acompañado del número y del nombre del nivel.
 */
export function coloresNivel(nivel: NivelIntensidad, colores: Paleta, altoContraste: boolean) {
    if (nivel === 'SEVERA') return { color: colores.error, fondo: colores.errorFondo };
    if (nivel === 'MODERADA') return altoContraste ? MODERADA.altoContraste : MODERADA.normal;
    return { color: colores.exito, fondo: colores.exitoFondo };
}

type Props = {
    intensidad: number;
    /** Tamaño del cuadro: normal en las listas, grande en el detalle. */
    grande?: boolean;
};

/** Cuadro con el número de la intensidad (1 a 10) en el color de su nivel. */
export function InsigniaIntensidad({ intensidad, grande }: Props) {
    const { colores, altoContraste } = useAccesibilidad();
    const nivel = nivelDe(intensidad);
    const { color, fondo } = coloresNivel(nivel, colores, altoContraste);

    return (
        <View
            accessible
            accessibilityLabel={`Intensidad ${intensidad} de 10, ${nombreNivel(nivel).toLowerCase()}`}
            style={[
                grande ? styles.grande : styles.normal,
                { backgroundColor: fondo, borderColor: color, borderWidth: altoContraste ? 2 : 0 },
            ]}>
            <Texto variante={grande ? 'titulo' : 'subtitulo'} peso="800" style={{ color }}>
                {intensidad}
            </Texto>
        </View>
    );
}

const styles = StyleSheet.create({
    normal: {
        width: 48,
        height: 48,
        borderRadius: Radio.s,
        alignItems: 'center',
        justifyContent: 'center',
    },
    grande: {
        width: 96,
        height: 96,
        borderRadius: Radio.l,
        alignItems: 'center',
        justifyContent: 'center',
    },
});