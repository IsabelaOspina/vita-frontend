import { Pressable, StyleSheet, View } from 'react-native';

import { Espacio, Radio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';

import { Icono, type NombreIcono } from './icono';
import { Texto } from './texto';

/**
 * Los tres accesos rápidos de accesibilidad del diseño UI-2.
 * `compacta` es la versión que va fija en el encabezado de todas las pantallas con sesión.
 */
export function BarraAccesibilidad({ compacta = false }: { compacta?: boolean }) {
    const { modoVoz, altoContraste, escalaTexto, alternarModoVoz, alternarContraste, siguienteTamanoTexto } =
        useAccesibilidad();

    return (
        <View style={[styles.fila, compacta && styles.filaCompacta]} accessibilityRole="toolbar" accessibilityLabel="Opciones de accesibilidad">
            <Opcion compacta={compacta} icono="microfono" titulo="Modo voz" activo={modoVoz} onPress={alternarModoVoz} />
            <Opcion compacta={compacta} icono="contraste" titulo="Alto contraste" activo={altoContraste} onPress={alternarContraste} />
            <Opcion
                compacta={compacta}
                icono="tamanoTexto"
                titulo="Tamaño de texto"
                detalle={`${Math.round(escalaTexto * 100)}%`}
                activo={escalaTexto > 1}
                onPress={siguienteTamanoTexto}
            />
        </View>
    );
}

type OpcionProps = {
    compacta: boolean;
    icono: NombreIcono;
    titulo: string;
    detalle?: string;
    activo: boolean;
    onPress: () => void;
};

function Opcion({ compacta, icono, titulo, detalle, activo, onPress }: OpcionProps) {
    const { colores } = useAccesibilidad();

    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="switch"
            accessibilityLabel={detalle ? `${titulo}, ${detalle}` : titulo}
            accessibilityState={{ checked: activo }}
            style={({ pressed }) => [
                styles.opcion,
                compacta && styles.opcionCompacta,
                {
                    backgroundColor: activo ? colores.primario : colores.superficie,
                    borderColor: activo ? colores.primario : colores.borde,
                },
                pressed && { transform: [{ scale: 0.96 }] },
            ]}>
            <Icono nombre={icono} tamano={compacta ? 22 : 26} color={activo ? colores.sobrePrimario : colores.primario} />
            <Texto
                variante="pequeno"
                peso="700"
                centrado
                style={{ color: activo ? colores.sobrePrimario : colores.texto }}
                numberOfLines={2}>
                {titulo}
            </Texto>
            {detalle && (
                <Texto variante="pequeno" centrado style={{ color: activo ? colores.sobrePrimario : colores.textoSecundario }}>
                    {detalle}
                </Texto>
            )}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    fila: {
        flexDirection: 'row',
        gap: Espacio.m,
    },
    filaCompacta: {
        gap: Espacio.s,
    },
    opcion: {
        flex: 1,
        minHeight: 96,
        borderRadius: Radio.l,
        borderWidth: 1.5,
        paddingVertical: Espacio.m,
        paddingHorizontal: Espacio.s,
        alignItems: 'center',
        justifyContent: 'center',
        gap: Espacio.xs,
    },
    opcionCompacta: {
        minHeight: 72,
        paddingVertical: Espacio.s,
        paddingHorizontal: Espacio.xs,
        gap: 2,
    },
});