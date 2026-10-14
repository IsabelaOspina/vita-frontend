import { Pressable, StyleSheet, View } from 'react-native';

import { Espacio, Radio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';

import { Texto } from './texto';

type Props<T extends string> = {
    /** Qué se está eligiendo, para el lector de pantalla ("Periodo", "Orden"). */
    etiqueta: string;
    opciones: { valor: T; titulo: string }[];
    valor: T;
    onCambiar: (valor: T) => void;
};

/** Fila de opciones pequeñas para filtrar (periodo, orden, agrupación…). Solo una queda elegida. */
export function OpcionesFiltro<T extends string>({ etiqueta, opciones, valor, onCambiar }: Props<T>) {
    const { colores } = useAccesibilidad();

    return (
        <View style={styles.fila} accessibilityRole="radiogroup" accessibilityLabel={etiqueta}>
            {opciones.map((opcion) => {
                const elegida = opcion.valor === valor;
                return (
                    <Pressable
                        key={opcion.valor}
                        onPress={() => onCambiar(opcion.valor)}
                        accessibilityRole="radio"
                        accessibilityLabel={`${etiqueta}: ${opcion.titulo}`}
                        accessibilityState={{ checked: elegida }}
                        hitSlop={4}
                        style={({ pressed }) => [
                            styles.chip,
                            {
                                backgroundColor: elegida ? colores.primario : colores.superficie,
                                borderColor: elegida ? colores.primario : colores.borde,
                            },
                            pressed && { opacity: 0.8 },
                        ]}>
                        <Texto variante="pequeno" peso={elegida ? '700' : '600'} color={elegida ? 'sobrePrimario' : 'textoSecundario'}>
                            {opcion.titulo}
                        </Texto>
                    </Pressable>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    fila: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Espacio.s,
    },
    chip: {
        minHeight: 44,
        justifyContent: 'center',
        paddingHorizontal: Espacio.l,
        borderRadius: Radio.total,
        borderWidth: 1.5,
    },
});