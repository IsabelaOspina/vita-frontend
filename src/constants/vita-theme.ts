/**
 * Tema visual de VITA.
 *
 * Hay dos paletas: la normal y la de alto contraste (fondo negro, texto blanco
 * y acentos amarillos), pensada para personas con baja visión.
 * El tamaño del texto se multiplica por la escala elegida en la barra de accesibilidad.
 */

export type Paleta = {
    fondo: string;
    superficie: string;
    superficieSuave: string;
    primario: string;
    primarioPresionado: string;
    sobrePrimario: string;
    texto: string;
    textoSecundario: string;
    textoTenue: string;
    borde: string;
    bordeFoco: string;
    error: string;
    errorFondo: string;
    exito: string;
    exitoFondo: string;
    info: string;
    infoFondo: string;
    acento: string;
    decoracionA: string;
    decoracionB: string;
    sombra: string;
    calendario: { fondo: string; icono: string };
    sintomas: { fondo: string; icono: string };
    emergencia: { fondo: string; icono: string };
};

export const Paletas: { normal: Paleta; altoContraste: Paleta } = {
    normal: {
        fondo: '#F4F7FD',
        superficie: '#FFFFFF',
        superficieSuave: '#EAF1FE',
        primario: '#1F6FEB',
        primarioPresionado: '#1757C2',
        sobrePrimario: '#FFFFFF',
        texto: '#0E1A33',
        textoSecundario: '#4E5D78',
        textoTenue: '#8391A9',
        borde: '#D8E1F0',
        bordeFoco: '#1F6FEB',
        error: '#C2283A',
        errorFondo: '#FDECEE',
        exito: '#15794B',
        exitoFondo: '#E3F6EC',
        info: '#1F6FEB',
        infoFondo: '#E6EFFE',
        acento: '#F25C7A',
        decoracionA: '#D6E5FF',
        decoracionB: '#FFE0E7',
        sombra: '#1F3A6B',
        calendario: { fondo: '#E3EDFF', icono: '#1F6FEB' },
        sintomas: { fondo: '#FFE6EC', icono: '#E2456A' },
        emergencia: { fondo: '#FFE9E2', icono: '#E0452B' },
    },
    altoContraste: {
        fondo: '#000000',
        superficie: '#000000',
        superficieSuave: '#141414',
        primario: '#FFE600',
        primarioPresionado: '#E6CF00',
        sobrePrimario: '#000000',
        texto: '#FFFFFF',
        textoSecundario: '#FFFFFF',
        textoTenue: '#E0E0E0',
        borde: '#FFFFFF',
        bordeFoco: '#FFE600',
        error: '#FF8A8A',
        errorFondo: '#000000',
        exito: '#7CFFB2',
        exitoFondo: '#000000',
        info: '#FFE600',
        infoFondo: '#000000',
        acento: '#FFE600',
        decoracionA: 'transparent',
        decoracionB: 'transparent',
        sombra: 'transparent',
        calendario: { fondo: '#000000', icono: '#FFE600' },
        sintomas: { fondo: '#000000', icono: '#FFE600' },
        emergencia: { fondo: '#000000', icono: '#FFE600' },
    },
};

/** Tamaños base del texto (antes de aplicar la escala de accesibilidad). */
export const TamanoTexto = {
    titulo: 30,
    subtitulo: 20,
    cuerpo: 17,
    etiqueta: 15,
    pequeno: 13.5,
} as const;

export type VarianteTexto = keyof typeof TamanoTexto;

/** Escalas que se recorren con el botón "Tamaño de texto". */
export const EscalasTexto = [1, 1.2, 1.4] as const;

export const Espacio = {
    xs: 4,
    s: 8,
    m: 12,
    l: 16,
    xl: 24,
    xxl: 32,
} as const;

export const Radio = {
    s: 12,
    m: 16,
    l: 22,
    total: 999,
} as const;

/** Alto mínimo de los elementos táctiles: más grande que el estándar (48) para facilitar el uso. */
export const AltoTactil = 56;

/** Ancho máximo del contenido, para que en tablet o web no se estire demasiado. */
export const AnchoMaximo = 480;