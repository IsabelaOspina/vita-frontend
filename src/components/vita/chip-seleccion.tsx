import { Pressable, StyleSheet, View } from 'react-native';

import { Espacio, Radio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';

import { Icono, type NombreIcono } from './icono';
import { Texto } from './texto';

type Props = {
    titulo: string;
    icono: NombreIcono;
    seleccionado: boolean;
    onPress: () => void;
};

/** Opción seleccionable en forma de tarjeta pequeña (por ejemplo, tipos de discapacidad). */
export function ChipSeleccion({ titulo, icono, seleccionado, onPress }: Props) {
    const { colores } = useAccesibilidad();

    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="checkbox"
            accessibilityLabel={titulo}
            accessibilityState={{ checked: seleccionado }}
            style={({ pressed }) => [
                styles.chip,
                {
                    backgroundColor: seleccionado ? colores.superficieSuave : colores.superficie,
                    borderColor: seleccionado ? colores.primario : colores.borde,
                    borderWidth: seleccionado ? 2 : 1.5,
                },
                pressed && { transform: [{ scale: 0.97 }] },
            ]}>
            <View
                style={[
                    styles.circulo,
                    { backgroundColor: seleccionado ? colores.primario : colores.superficieSuave },
                ]}>
                <Icono
                    nombre={seleccionado ? 'check' : icono}
                    tamano={20}
                    color={seleccionado ? colores.sobrePrimario : colores.primario}
                />
            </View>
            <Texto variante="etiqueta" peso={seleccionado ? '700' : '600'} style={styles.texto}>
                {titulo}
            </Texto>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    chip: {
        flexGrow: 1,
        flexBasis: '45%',
        minHeight: 64,
        borderRadius: Radio.m,
        padding: Espacio.m,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Espacio.m,
    },
    circulo: {
        width: 36,
        height: 36,
        borderRadius: Radio.total,
        alignItems: 'center',
        justifyContent: 'center',
    },
    texto: {
        flexShrink: 1,
    },
});