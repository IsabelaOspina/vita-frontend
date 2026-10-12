import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AltoTactil, Espacio, Radio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';

import { Icono, type NombreIcono } from './icono';
import { Texto } from './texto';

type Props = {
    titulo: string;
    onPress: () => void;
    variante?: 'primario' | 'secundario';
    icono?: NombreIcono;
    cargando?: boolean;
    deshabilitado?: boolean;
    /** Descripción extra para el lector de pantalla. */
    pista?: string;
};

export function Boton({ titulo, onPress, variante = 'primario', icono, cargando, deshabilitado, pista }: Props) {
    const { colores, altoContraste } = useAccesibilidad();
    const esPrimario = variante === 'primario';
    const inactivo = deshabilitado || cargando;
    const colorContenido = esPrimario ? colores.sobrePrimario : colores.primario;

    return (
        <Pressable
            onPress={onPress}
            disabled={inactivo}
            accessibilityRole="button"
            accessibilityLabel={titulo}
            accessibilityHint={pista}
            accessibilityState={{ disabled: !!inactivo, busy: !!cargando }}
            style={({ pressed }) => [
                styles.base,
                esPrimario
                    ? {
                        backgroundColor: pressed ? colores.primarioPresionado : colores.primario,
                    }
                    : {
                        backgroundColor: pressed ? colores.superficieSuave : colores.superficie,
                        borderWidth: 2,
                        borderColor: colores.primario,
                    },
                esPrimario && !altoContraste && styles.sombra,
                pressed && styles.presionado,
                inactivo && styles.inactivo,
            ]}>
            {cargando ? (
                <ActivityIndicator color={colorContenido} />
            ) : (
                <View style={styles.contenido}>
                    <Texto variante="cuerpo" peso="700" style={{ color: colorContenido }}>
                        {titulo}
                    </Texto>
                    {icono && <Icono nombre={icono} tamano={22} color={colorContenido} />}
                </View>
            )}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    base: {
        minHeight: AltoTactil,
        borderRadius: Radio.m,
        paddingHorizontal: Espacio.xl,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sombra: {
        boxShadow: '0px 8px 16px rgba(31, 111, 235, 0.28)',
    },
    contenido: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Espacio.s,
    },
    presionado: {
        transform: [{ scale: 0.98 }],
    },
    inactivo: {
        opacity: 0.6,
    },
});