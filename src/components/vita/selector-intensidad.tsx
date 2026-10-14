import { Pressable, StyleSheet, View } from 'react-native';

import { Espacio, Radio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';
import { nivelDe, nombreNivel } from '@/utils/sintomas';

import { Icono } from './icono';
import { coloresNivel } from './insignia-intensidad';
import { Texto } from './texto';

type Props = {
    valor: number | null;
    onCambiar: (valor: number) => void;
    error?: string;
};

const NUMEROS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** Escala del 1 al 10 en botones grandes, cada uno con el color de su nivel. */
export function SelectorIntensidad({ valor, onCambiar, error }: Props) {
    const { colores, altoContraste, leer } = useAccesibilidad();

    return (
        <View style={styles.contenedor}>
            <Texto variante="etiqueta">Intensidad (del 1 al 10)</Texto>
            <Texto variante="pequeno" color="textoSecundario">
                1 es muy leve y 10 es insoportable.
            </Texto>

            <View style={styles.escala} accessibilityRole="radiogroup" accessibilityLabel="Intensidad del 1 al 10">
                {NUMEROS.map((n) => {
                    const elegido = valor === n;
                    const nivel = nivelDe(n);
                    const { color, fondo } = coloresNivel(nivel, colores, altoContraste);
                    return (
                        <Pressable
                            key={n}
                            onPress={() => {
                                onCambiar(n);
                                leer(`Intensidad ${n}, ${nombreNivel(nivel).toLowerCase()}`);
                            }}
                            accessibilityRole="radio"
                            accessibilityLabel={`${n}, ${nombreNivel(nivel).toLowerCase()}`}
                            accessibilityState={{ checked: elegido }}
                            style={({ pressed }) => [
                                styles.numero,
                                {
                                    backgroundColor: elegido ? color : fondo,
                                    borderColor: elegido ? colores.texto : altoContraste ? color : 'transparent',
                                },
                                pressed && { transform: [{ scale: 0.95 }] },
                            ]}>
                            <Texto variante="subtitulo" peso="800" style={{ color: elegido ? (altoContraste ? '#000000' : '#FFFFFF') : color }}>
                                {n}
                            </Texto>
                        </Pressable>
                    );
                })}
            </View>

            {valor !== null && (
                <Texto variante="etiqueta" centrado style={{ color: coloresNivel(nivelDe(valor), colores, altoContraste).color }}>
                    {valor} de 10 · {nombreNivel(nivelDe(valor))}
                </Texto>
            )}

            {error ? (
                <View style={styles.mensaje} accessibilityLiveRegion="polite">
                    <Icono nombre="error" tamano={16} color={colores.error} />
                    <Texto variante="pequeno" color="error" peso="600" style={styles.textoMensaje}>
                        {error}
                    </Texto>
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    contenedor: {
        gap: Espacio.s,
    },
    escala: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Espacio.s,
    },
    numero: {
        // Cinco por fila: botones grandes, fáciles de tocar
        flexBasis: '17%',
        flexGrow: 1,
        minHeight: 52,
        borderRadius: Radio.s,
        borderWidth: 3,
        alignItems: 'center',
        justifyContent: 'center',
    },
    mensaje: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Espacio.xs,
    },
    textoMensaje: {
        flexShrink: 1,
    },
});