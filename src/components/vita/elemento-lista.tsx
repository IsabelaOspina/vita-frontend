import { Pressable, StyleSheet, View } from 'react-native';

import { Espacio, Radio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';

import { Icono, type NombreIcono } from './icono';
import { Texto } from './texto';

type AccionElemento = {
    titulo: string;
    icono: NombreIcono;
    onPress: () => void;
    /** Acciones que quitan algo (desactivar, quitar asignación) se muestran en rojo. */
    peligro?: boolean;
    /** Qué hace el botón, para el lector de pantalla ("Desactivar la cuenta de Ana"). */
    descripcion?: string;
};

type Props = {
    titulo: string;
    /** Líneas debajo del nombre (correo, especialidad…). */
    lineas?: string[];
    /** Etiqueta destacada, por ejemplo "Desactivada". */
    estado?: { texto: string; tipo: 'error' | 'exito' | 'info' };
    /** Al tocar el elemento (por ejemplo, para ver el detalle). */
    onPress?: () => void;
    descripcionPress?: string;
    acciones?: AccionElemento[];
};

/** Iniciales para el círculo: "María Gómez" → "MG". */
function iniciales(nombre: string) {
    return nombre
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase())
        .join('');
}

/** Un elemento de una lista de personas: círculo con iniciales, nombre, detalles y botones. */
export function ElementoLista({ titulo, lineas = [], estado, onPress, descripcionPress, acciones = [] }: Props) {
    const { colores } = useAccesibilidad();
    const resumen = [titulo, ...lineas, estado?.texto].filter(Boolean).join('. ');

    const contenido = (
        <View style={styles.fila}>
            <View style={[styles.avatar, { backgroundColor: colores.superficieSuave, borderColor: colores.primario }]}>
                <Texto variante="etiqueta" color="primario" peso="800">
                    {iniciales(titulo)}
                </Texto>
            </View>
            <View style={styles.textos}>
                <Texto variante="cuerpo" peso="700">
                    {titulo}
                </Texto>
                {lineas.map((linea) => (
                    <Texto key={linea} variante="pequeno" color="textoSecundario">
                        {linea}
                    </Texto>
                ))}
                {estado && (
                    <View style={[styles.estado, { backgroundColor: colores[`${estado.tipo}Fondo`], borderColor: colores[estado.tipo] }]}>
                        <Texto variante="pequeno" peso="700" style={{ color: colores[estado.tipo] }}>
                            {estado.texto}
                        </Texto>
                    </View>
                )}
            </View>
            {onPress && <Icono nombre="siguiente" tamano={22} color={colores.textoTenue} />}
        </View>
    );

    return (
        <View style={[styles.contenedor, { borderColor: colores.borde }]}>
            {onPress ? (
                <Pressable
                    onPress={onPress}
                    accessibilityRole="button"
                    accessibilityLabel={resumen}
                    accessibilityHint={descripcionPress}
                    style={({ pressed }) => [styles.presionable, pressed && { backgroundColor: colores.superficieSuave }]}>
                    {contenido}
                </Pressable>
            ) : (
                <View accessible accessibilityLabel={resumen} style={styles.presionable}>
                    {contenido}
                </View>
            )}

            {acciones.length > 0 && (
                <View style={styles.acciones}>
                    {acciones.map((accion) => {
                        const color = accion.peligro ? colores.error : colores.primario;
                        return (
                            <Pressable
                                key={accion.titulo}
                                onPress={accion.onPress}
                                accessibilityRole="button"
                                accessibilityLabel={accion.descripcion ?? `${accion.titulo} ${titulo}`}
                                style={({ pressed }) => [
                                    styles.boton,
                                    { borderColor: color, backgroundColor: pressed ? colores.superficieSuave : colores.superficie },
                                ]}>
                                <Icono nombre={accion.icono} tamano={20} color={color} />
                                <Texto variante="etiqueta" peso="700" style={{ color }}>
                                    {accion.titulo}
                                </Texto>
                            </Pressable>
                        );
                    })}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    contenedor: {
        borderWidth: 1.5,
        borderRadius: Radio.m,
        overflow: 'hidden',
    },
    presionable: {
        padding: Espacio.l,
    },
    fila: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Espacio.m,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: Radio.total,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    textos: {
        flex: 1,
        minWidth: 0,
        gap: 2,
    },
    estado: {
        alignSelf: 'flex-start',
        marginTop: Espacio.xs,
        paddingHorizontal: Espacio.s,
        paddingVertical: 2,
        borderRadius: Radio.total,
        borderWidth: 1,
    },
    acciones: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Espacio.s,
        paddingHorizontal: Espacio.l,
        paddingBottom: Espacio.l,
    },
    boton: {
        flexGrow: 1,
        minHeight: 48,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Espacio.xs,
        paddingHorizontal: Espacio.l,
        borderRadius: Radio.s,
        borderWidth: 1.5,
    },
});