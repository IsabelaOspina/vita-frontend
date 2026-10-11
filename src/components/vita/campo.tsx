import { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { AltoTactil, Espacio, Radio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';
import { ajustarDictado, useDictado, type TipoDictado } from '@/hooks/use-dictado';

import { Icono, type NombreIcono } from './icono';
import { Texto } from './texto';

type Props = Omit<TextInputProps, 'style'> & {
  etiqueta: string;
  icono?: NombreIcono;
  /** Texto de ayuda debajo del campo (se reemplaza por el error si lo hay). */
  ayuda?: string;
  error?: string;
  /** Muestra el botón del ojo para ver u ocultar la contraseña. */
  esContrasena?: boolean;
  /**
   * Muestra el botón de micrófono para llenar el campo por voz, y dice cómo ajustar lo dictado
   * (por ejemplo, en un correo "arroba" se convierte en @). No se usa en contraseñas.
   */
  dictado?: TipoDictado;
};

/**
 * Campo de formulario con etiqueta visible arriba (no solo placeholder),
 * para que siempre se sepa qué se está llenando, incluso con texto escrito.
 */
export const Campo = forwardRef<TextInput, Props>(function Campo(
  { etiqueta, icono, ayuda, error, esContrasena, dictado, onFocus, onBlur, onChangeText, ...props },
  ref,
) {
  const { colores, tamano, leer, anunciar } = useAccesibilidad();
  const [enfocado, setEnfocado] = useState(false);
  const [oculto, setOculto] = useState(true);
  const [errorDictado, setErrorDictado] = useState<string | null>(null);

  const voz = useDictado({
    alReconocer: (texto, esFinal) => {
      const ajustado = ajustarDictado(texto, dictado ?? 'texto');
      onChangeText?.(ajustado);
      // Con modo voz, confirma en voz alta lo que quedó escrito
      if (esFinal) leer(`${etiqueta}: ${ajustado}`);
    },
    alFallar: (mensaje) => {
      setErrorDictado(mensaje);
      anunciar(mensaje);
    },
  });

  const conDictado = !!dictado && !esContrasena && voz.disponible;
  const mensajeError = error ?? errorDictado ?? undefined;

  const colorBorde = voz.escuchando
    ? colores.primario
    : mensajeError
      ? colores.error
      : enfocado
        ? colores.bordeFoco
        : colores.borde;
  const colorIcono = mensajeError ? colores.error : enfocado ? colores.primario : colores.textoTenue;

  const alternarDictado = () => {
    setErrorDictado(null);
    if (voz.escuchando) voz.detener();
    else voz.iniciar();
  };

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
            borderWidth: enfocado || mensajeError || voz.escuchando ? 2 : 1.5,
          },
        ]}>
        {icono && <Icono nombre={icono} tamano={22} color={colorIcono} />}

        <TextInput
          ref={ref}
          {...props}
          onChangeText={(texto) => {
            setErrorDictado(null);
            onChangeText?.(texto);
          }}
          secureTextEntry={esContrasena && oculto}
          placeholderTextColor={colores.textoTenue}
          accessibilityLabel={etiqueta}
          accessibilityHint={mensajeError ?? ayuda}
          onFocus={(e) => {
            setEnfocado(true);
            // Con modo voz, dice qué campo se está llenando, su error o ayuda, y si se puede dictar
            leer(
              [etiqueta, mensajeError ?? ayuda, conDictado ? 'Puedes escribir o tocar el micrófono para dictar' : null]
                .filter(Boolean)
                .join('. '),
            );
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setEnfocado(false);
            onBlur?.(e);
          }}
          style={[styles.input, { color: colores.texto, fontSize: tamano('cuerpo') }]}
        />

        {conDictado && (
          <Pressable
            onPress={alternarDictado}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={voz.escuchando ? 'Detener dictado' : `Dictar ${etiqueta.toLowerCase()} por voz`}
            accessibilityState={{ selected: voz.escuchando }}
            style={({ pressed }) => [
              styles.botonMicrofono,
              {
                backgroundColor: voz.escuchando ? colores.primario : colores.superficieSuave,
              },
              pressed && { opacity: 0.75 },
            ]}>
            <Icono
              nombre="microfono"
              tamano={20}
              color={voz.escuchando ? colores.sobrePrimario : colores.primario}
            />
          </Pressable>
        )}

        {esContrasena && (
          <Pressable
            onPress={() => setOculto(!oculto)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={oculto ? 'Mostrar contraseña' : 'Ocultar contraseña'}
            style={styles.botonOjo}>
            <Icono nombre={oculto ? 'ojo' : 'ojoTachado'} tamano={22} color={colores.textoSecundario} />
          </Pressable>
        )}
      </View>

      {voz.escuchando ? (
        <View style={styles.mensaje} accessibilityLiveRegion="polite">
          <Icono nombre="microfono" tamano={16} color={colores.primario} />
          <Texto variante="pequeno" color="primario" peso="700" style={styles.textoMensaje}>
            Escuchando… habla ahora
          </Texto>
        </View>
      ) : mensajeError ? (
        <View style={styles.mensaje} accessibilityLiveRegion="polite">
          <Icono nombre="error" tamano={16} color={colores.error} />
          <Texto variante="pequeno" color="error" peso="600" style={styles.textoMensaje}>
            {mensajeError}
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
    // Sin esto, en web el input no se encoge y empuja los botones fuera del campo
    minWidth: 0,
    paddingVertical: Espacio.m,
    // En web quita el recuadro azul por defecto: el borde del campo ya indica el foco
    outlineStyle: 'none',
  } as object,
  botonMicrofono: {
    width: 40,
    height: 40,
    borderRadius: Radio.total,
    alignItems: 'center',
    justifyContent: 'center',
  },
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