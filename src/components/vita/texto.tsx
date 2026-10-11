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

/** Texto de VITA: aplica el color del tema y la escala de tamaño de accesibilidad. */
export function Texto({ variante = 'cuerpo', color = 'texto', peso, centrado, style, ...props }: Props) {
    const { colores, tamano } = useAccesibilidad();
    const fontSize = tamano(variante);

    return (
        <Text
            {...props}
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