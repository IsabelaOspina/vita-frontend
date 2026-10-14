import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Espacio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';

import { Aviso } from './aviso';
import { Boton } from './boton';
import { Texto } from './texto';

type Props = {
    cargando: boolean;
    error?: string | null;
    /** Para el botón "Intentar de nuevo" cuando hay error. */
    reintentar?: () => void;
    /** Texto cuando ya cargó y no hay nada (por ejemplo "Aún no tienes pacientes asignados"). */
    vacio?: string;
    hayDatos: boolean;
};

/**
 * Lo que se ve en una lista mientras carga, si falla o si está vacía.
 * Devuelve null cuando hay datos para mostrar.
 */
export function EstadoCarga({ cargando, error, reintentar, vacio, hayDatos }: Props) {
    const { colores } = useAccesibilidad();

    if (cargando && !hayDatos) {
        return (
            <View style={styles.centro} accessible accessibilityLabel="Cargando">
                <ActivityIndicator color={colores.primario} size="large" />
                <Texto variante="etiqueta" color="textoSecundario">
                    Cargando…
                </Texto>
            </View>
        );
    }
    if (error) {
        return (
            <View style={styles.error}>
                <Aviso mensaje={error} />
                {reintentar && <Boton titulo="Intentar de nuevo" icono="recargar" variante="secundario" onPress={reintentar} />}
            </View>
        );
    }
    if (!hayDatos && vacio) {
        return (
            <Texto variante="cuerpo" color="textoSecundario" centrado style={styles.vacio}>
                {vacio}
            </Texto>
        );
    }
    return null;
}

const styles = StyleSheet.create({
    centro: {
        alignItems: 'center',
        gap: Espacio.s,
        paddingVertical: Espacio.xl,
    },
    error: {
        gap: Espacio.m,
    },
    vacio: {
        paddingVertical: Espacio.l,
    },
});