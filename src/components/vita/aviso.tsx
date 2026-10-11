import { StyleSheet, View } from 'react-native';

import { Espacio, Radio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';

import { Icono, type NombreIcono } from './icono';
import { Texto } from './texto';

type Props = {
    mensaje: string;
    tipo?: 'error' | 'exito' | 'info';
};

const ICONO_POR_TIPO: Record<NonNullable<Props['tipo']>, NombreIcono> = {
    error: 'error',
    exito: 'check',
    info: 'info',
};

/** Mensaje destacado de un formulario o pantalla: error, éxito o información. */
export function Aviso({ mensaje, tipo = 'error' }: Props) {
    const { colores } = useAccesibilidad();
    const color = colores[tipo];
    const fondo = colores[`${tipo}Fondo`];

    return (
        <View
            accessibilityRole={tipo === 'error' ? 'alert' : 'text'}
            accessibilityLiveRegion={tipo === 'error' ? 'assertive' : 'polite'}
            style={[styles.aviso, { backgroundColor: fondo, borderColor: color }]}>
            <Icono nombre={ICONO_POR_TIPO[tipo]} tamano={22} color={color} />
            <Texto variante="etiqueta" style={[styles.texto, { color }]}>
                {mensaje}
            </Texto>
        </View>
    );
}

const styles = StyleSheet.create({
    aviso: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Espacio.m,
        padding: Espacio.l,
        borderRadius: Radio.m,
        borderWidth: 1.5,
    },
    texto: {
        flex: 1,
    },
});