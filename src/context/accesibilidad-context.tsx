import { createContext, useContext, useState, type ReactNode } from 'react';
import { AccessibilityInfo } from 'react-native';

import { EscalasTexto, Paletas, TamanoTexto, type Paleta, type VarianteTexto } from '@/constants/vita-theme';

/**
 * Preferencias de accesibilidad de la interfaz (alto contraste, tamaño de texto y modo voz).
 * Se pueden cambiar antes de iniciar sesión, desde la barra del login.
 *
 * Por ahora viven en memoria. Cuando exista el servicio de usuario, se pueden
 * inicializar con la configuracionAccesibilidad que devuelve el backend.
 */
type Accesibilidad = {
    colores: Paleta;
    altoContraste: boolean;
    escalaTexto: number;
    modoVoz: boolean;
    /** Tamaño de fuente ya escalado para una variante de texto. */
    tamano: (variante: VarianteTexto) => number;
    alternarContraste: () => void;
    siguienteTamanoTexto: () => void;
    alternarModoVoz: () => void;
    /** Lee un mensaje en voz alta con el lector de pantalla del sistema (si está activo). */
    anunciar: (mensaje: string) => void;
};

const AccesibilidadContext = createContext<Accesibilidad | null>(null);

export function AccesibilidadProvider({ children }: { children: ReactNode }) {
    const [altoContraste, setAltoContraste] = useState(false);
    const [indiceEscala, setIndiceEscala] = useState(0);
    const [modoVoz, setModoVoz] = useState(false);

    const escalaTexto = EscalasTexto[indiceEscala];

    const anunciar = (mensaje: string) => {
        AccessibilityInfo.announceForAccessibility(mensaje);
    };

    const valor: Accesibilidad = {
        colores: altoContraste ? Paletas.altoContraste : Paletas.normal,
        altoContraste,
        escalaTexto,
        modoVoz,
        tamano: (variante) => Math.round(TamanoTexto[variante] * escalaTexto),
        alternarContraste: () => {
            const nuevo = !altoContraste;
            setAltoContraste(nuevo);
            anunciar(nuevo ? 'Alto contraste activado' : 'Alto contraste desactivado');
        },
        siguienteTamanoTexto: () => {
            const siguiente = (indiceEscala + 1) % EscalasTexto.length;
            setIndiceEscala(siguiente);
            anunciar(`Tamaño de texto ${Math.round(EscalasTexto[siguiente] * 100)} por ciento`);
        },
        alternarModoVoz: () => {
            const nuevo = !modoVoz;
            setModoVoz(nuevo);
            anunciar(nuevo ? 'Modo voz activado' : 'Modo voz desactivado');
        },
        anunciar,
    };

    return <AccesibilidadContext.Provider value={valor}>{children}</AccesibilidadContext.Provider>;
}

export function useAccesibilidad() {
    const contexto = useContext(AccesibilidadContext);
    if (!contexto) {
        throw new Error('useAccesibilidad debe usarse dentro de <AccesibilidadProvider>');
    }
    return contexto;
}