import { createContext, useContext, useState, type ReactNode } from 'react';
import { AccessibilityInfo } from 'react-native';

import { EscalasTexto, Paletas, TamanoTexto, type Paleta, type VarianteTexto } from '@/constants/vita-theme';
import { callar, hablar } from '@/utils/voz';

/**
 * Preferencias de accesibilidad de la interfaz (alto contraste, tamaño de texto y modo voz).
 * Se pueden cambiar antes de iniciar sesión, desde la barra del login.
 *
 * Modo voz: la app lee en voz alta (sin necesitar el lector de pantalla del celular) el nombre
 * de cada pantalla, cada campo al tocarlo y los mensajes de error o éxito. Además, mientras está
 * activo, el asistente "Oye VITA" escucha órdenes (ver asistente-context).
 *
 * Por ahora las preferencias viven en memoria. Cuando exista el servicio de usuario, se pueden
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
    /** Recorre los tamaños 100% → 120% → 140% → 100% (botón de la barra). */
    siguienteTamanoTexto: () => void;
    /** Sube o baja un tamaño (usado por el asistente de voz). Devuelve false si ya estaba en el límite. */
    cambiarTamanoTexto: (cambio: 'aumentar' | 'disminuir') => boolean;
    alternarModoVoz: () => void;
    /**
     * Comunica un mensaje importante (errores, éxito, cambios de ajustes).
     * Con modo voz lo dice en voz alta; sin modo voz se lo pasa al lector de pantalla del sistema.
     */
    anunciar: (mensaje: string) => void;
    /**
     * Lee un texto en voz alta solo si el modo voz está activo.
     * Con `esperar` se pone en cola detrás de lo que se esté diciendo, en vez de interrumpirlo.
     */
    leer: (texto: string, esperar?: boolean) => void;
};

const AccesibilidadContext = createContext<Accesibilidad | null>(null);

export function AccesibilidadProvider({ children }: { children: ReactNode }) {
    const [altoContraste, setAltoContraste] = useState(false);
    const [indiceEscala, setIndiceEscala] = useState(0);
    const [modoVoz, setModoVoz] = useState(false);

    const escalaTexto = EscalasTexto[indiceEscala];

    const anunciar = (mensaje: string) => {
        if (modoVoz) hablar(mensaje);
        else AccessibilityInfo.announceForAccessibility(mensaje);
    };

    const aplicarEscala = (indice: number) => {
        setIndiceEscala(indice);
        anunciar(`Tamaño de texto ${Math.round(EscalasTexto[indice] * 100)} por ciento`);
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
        siguienteTamanoTexto: () => aplicarEscala((indiceEscala + 1) % EscalasTexto.length),
        cambiarTamanoTexto: (cambio) => {
            const siguiente = indiceEscala + (cambio === 'aumentar' ? 1 : -1);
            if (siguiente < 0 || siguiente >= EscalasTexto.length) return false;
            aplicarEscala(siguiente);
            return true;
        },
        alternarModoVoz: () => {
            const nuevo = !modoVoz;
            setModoVoz(nuevo);
            // El mensaje de bienvenida al activarlo lo dice el asistente, porque depende de si
            // el reconocimiento de voz está disponible en este dispositivo
            if (!nuevo) {
                callar();
                AccessibilityInfo.announceForAccessibility('Modo voz desactivado');
            }
        },
        anunciar,
        leer: (texto, esperar) => {
            if (modoVoz) hablar(texto, esperar);
        },
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