import { forwardRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { AltoTactil, Espacio, Radio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';

import { Icono, type NombreIcono } from './icono';
import { Texto } from './texto';

/**
 * Microsoft Edge (y algunos navegadores) agregan su propio botón de "ver contraseña" dentro del
 * campo, y quedaban dos ojos. Se oculta el del navegador: el campo ya tiene el suyo.
 */
if (Platform.OS === 'web' && typeof document !== 'undefined' && !document.getElementById('vita-sin-ojo-navegador')) {
    const estilo = document.createElement('style');
    estilo.id = 'vita-sin-ojo-navegador';
    estilo.textContent =
        'input::-ms-reveal, input::-ms-clear { display: none !important; }' +
        'input::-webkit-credentials-auto-fill-button, input::-webkit-contacts-auto-fill-button { visibility: hidden; display: none !important; }';
    document.head.appendChild(estilo);
}

type Props = Omit<TextInputProps, 'style'> & {
    etiqueta: string;
    icono?: NombreIcono;
    /** Texto de ayuda debajo del campo (se reemplaza por el error si lo hay). */
    ayuda?: string;
    error?: string;
    /** Muestra el botón del ojo para ver u ocultar la contraseña. */
    esContrasena?: boolean;
};

/**
 * Campo de formulario con etiqueta visible arriba (no solo placeholder),
 * para que siempre se sepa qué se está llenando, incluso con texto escrito.
 */
export const Campo = forwardRef<TextInput, Props>(function Campo(
    { etiqueta, icono, ayuda, error, esContrasena, onFocus, onBlur, ...props },
    ref,
) {
    const { colores, tamano, leer } = useAccesibilidad();
    const [enfocado, setEnfocado] = useState(false);
    const [oculto, setOculto] = useState(true);

    const colorBorde = error ? colores.error : enfocado ? colores.bordeFoco : colores.borde;
    const colorIcono = error ? colores.error : enfocado ? colores.primario : colores.textoTenue;

    return (
        <View style={styles.contenedor}>
            <Texto variante="etiqueta" color="texto">
                {etiqueta}
            </Texto>

            <View
                style={[
                    styles.caja,
                    {
                        backgroundColor: colores.superficie,
                        borderColor: colorBorde,
                        borderWidth: enfocado || error ? 2 : 1.5,
                    },
                ]}>
                {icono && <Icono nombre={icono} tamano={22} color={colorIcono} />}

                <TextInput
                    ref={ref}
                    {...props}
                    secureTextEntry={esContrasena && oculto}
                    placeholderTextColor={colores.textoTenue}
                    accessibilityLabel={etiqueta}
                    accessibilityHint={error ?? ayuda}
                    onFocus={(e) => {
                        setEnfocado(true);
                        // Con modo voz, dice qué campo se está llenando y su error o ayuda
                        leer([etiqueta, error ?? ayuda].filter(Boolean).join('. '));
                        onFocus?.(e);
                    }}
                    onBlur={(e) => {
                        setEnfocado(false);
                        onBlur?.(e);
                    }}
                    style={[styles.input, { color: colores.texto, fontSize: tamano('cuerpo') }]}
                />

                {esContrasena && (
                    <Pressable
                        onPress={() => setOculto(!oculto)}
                        hitSlop={12}
                        accessibilityRole="button"
                        accessibilityLabel={oculto ? 'Mostrar contraseña' : 'Ocultar contraseña'}
                        style={styles.botonOjo}>
                        {/* El ojo muestra cómo está la contraseña: tachado si está oculta, abierto si se ve */}
                        <Icono nombre={oculto ? 'ojoTachado' : 'ojo'} tamano={22} color={colores.textoSecundario} />
                    </Pressable>
                )}
            </View>

            {error ? (
                <View style={styles.mensaje} accessibilityLiveRegion="polite">
                    <Icono nombre="error" tamano={16} color={colores.error} />
                    <Texto variante="pequeno" color="error" peso="600" style={styles.textoMensaje}>
                        {error}
                    </Texto>
                </View>
            ) : ayuda ? (
                <Texto variante="pequeno" color="textoSecundario">
                    {ayuda}
                </Texto>
            ) : null}
        </View>
    );
});

const styles = StyleSheet.create({
    contenedor: {
        gap: Espacio.s,
    },
    caja: {
        minHeight: AltoTactil,
        borderRadius: Radio.m,
        paddingHorizontal: Espacio.l,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Espacio.m,
    },
    input: {
        flex: 1,
        minWidth: 0,
        paddingVertical: Espacio.m,
        outlineStyle: 'none',
    } as object,
    botonOjo: {
        padding: Espacio.xs,
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