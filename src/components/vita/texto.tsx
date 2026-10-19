import { Text, type TextProps } from 'react-native';

import type { VarianteTexto } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';

type Props = TextProps & {
    variante?: VarianteTexto;
    color?: 'texto' | 'textoSecundario' | 'textoTenue' | 'primario' | 'error' | 'sobrePrimario';
    peso?: '400' | '500' | '600' | '700' | '800';
    centrado?: boolean;
};

const PESO_POR_VARIANTE: Record<VarianteTexto, Props['peso']> = {
    titulo: '800',
    subtitulo: '700',
    cuerpo: '400',
    etiqueta: '600',
    pequeno: '400',
};

/**
 * Cuánto puede agrandar el celular las letras (Ajustes del celular → Tamaño de fuente).
 * VITA ya tiene su propio botón de tamaño (hasta 140 %); si además el celular las agranda sin
 * límite, los textos no caben y se cortan. Con este tope se ven grandes pero completos.
 */
export const ESCALA_MAXIMA_DEL_CELULAR = 1.3;

/** Texto de VITA: aplica el color del tema y la escala de tamaño de accesibilidad. */
export function Texto({ variante = 'cuerpo', color = 'texto', peso, centrado, style, maxFontSizeMultiplier = ESCALA_MAXIMA_DEL_CELULAR, ...props }: Props) {
    const { colores, tamano } = useAccesibilidad();
    const fontSize = tamano(variante);

    return (
        <Text
            {...props}
            maxFontSizeMultiplier={maxFontSizeMultiplier}
            style={[
                {
                    color: colores[color],
                    fontSize,
                    lineHeight: Math.round(fontSize * (variante === 'titulo' ? 1.2 : 1.4)),
                    fontWeight: peso ?? PESO_POR_VARIANTE[variante],
                    letterSpacing: variante === 'titulo' ? -0.5 : 0,
                    textAlign: centrado ? 'center' : undefined,
                },
                style,
            ]}
        />
    );
}