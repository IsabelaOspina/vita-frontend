import { Pressable, StyleSheet, View } from 'react-native';

import { Espacio, Radio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';

import { Texto } from './texto';

type Props<T extends string> = {
    /** Qué se está eligiendo, para el lector de pantalla ("Periodo"). */
    etiqueta: string;
    opciones: { valor: T; titulo: string }[];
    valor: T;
    onCambiar: (valor: T) => void;
};

/**
 * Opciones unidas en una sola barra (por ejemplo: 7 días · 30 días · 3 meses · 1 año).
 * La elegida se ve como una pestaña blanca resaltada. Solo una queda elegida.
 */
export function ControlSegmentado<T extends string>({ etiqueta, opciones, valor, onCambiar }: Props<T>) {
    const { colores, altoContraste } = useAccesibilidad();

    return (
        <View
            style={[
                styles.barra,
                { backgroundColor: altoContraste ? colores.fondo : colores.superficieSuave, borderColor: colores.borde, borderWidth: altoContraste ? 2 : 0 },
            ]}
            accessibilityRole="radiogroup"
            accessibilityLabel={etiqueta}>
            {opciones.map((opcion) => {
                const elegida = opcion.valor === valor;
                return (
                    <Pressable
                        key={opcion.valor}
                        onPress={() => onCambiar(opcion.valor)}
                        accessibilityRole="radio"
                        accessibilityLabel={`${etiqueta}: ${opcion.titulo}`}
                        accessibilityState={{ checked: elegida }}
                        style={({ pressed }) => [
                            styles.opcion,
                            elegida && {
                                backgroundColor: altoContraste ? colores.primario : colores.superficie,
                                boxShadow: altoContraste ? undefined : '0px 1px 4px rgba(20, 40, 90, 0.15)',
                            },
                            pressed && { opacity: 0.8 },
                        ]}>
                        <Texto
                            variante="pequeno"
                            peso={elegida ? '700' : '600'}
                            centrado
                            color={elegida ? (altoContraste ? 'sobrePrimario' : 'primario') : 'textoSecundario'}>
                            {opcion.titulo}
                        </Texto>
                    </Pressable>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    barra: {
        flexDirection: 'row',
        borderRadius: Radio.m,
        padding: 4,
        gap: 4,
    },
    opcion: {
        flex: 1,
        minHeight: 44,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: Espacio.xs,
        borderRadius: Radio.s,
    },
});