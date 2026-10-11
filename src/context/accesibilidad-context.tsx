import * as Speech from 'expo-speech';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo } from 'react-native';

import { EscalasTexto, Paletas, TamanoTexto, type Paleta, type VarianteTexto } from '@/constants/vita-theme';

/** Idioma de la voz. es-MX es la voz en español latino disponible en la mayoría de celulares. */
const IDIOMA_VOZ = 'es-MX';

/**
 * Preferencias de accesibilidad de la interfaz (alto contraste, tamaño de texto y modo voz).
 * Se pueden cambiar antes de iniciar sesión, desde la barra del login.
 *
 * Modo voz: con expo-speech la app lee en voz alta, sin necesidad de tener activado
 * el lector de pantalla del celular: el nombre de cada pantalla al entrar, cada campo
 * al tocarlo, y los mensajes de error o de éxito.
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
    siguienteTamanoTexto: () => void;
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

function hablar(texto: string, esperar = false) {
    if (!esperar) Speech.stop();
    Speech.speak(texto, { language: IDIOMA_VOZ, rate: 0.95 });
}

export function AccesibilidadProvider({ children }: { children: ReactNode }) {
    const [altoContraste, setAltoContraste] = useState(false);
    const [indiceEscala, setIndiceEscala] = useState(0);
    const [modoVoz, setModoVoz] = useState(false);

    const escalaTexto = EscalasTexto[indiceEscala];

    const anunciar = (mensaje: string) => {
        if (modoVoz) hablar(mensaje);
        else AccessibilityInfo.announceForAccessibility(mensaje);
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
            if (nuevo) {
                hablar('Modo voz activado. Te leeré en voz alta cada campo al tocarlo y los mensajes de la aplicación.');
            } else {
                Speech.stop();
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

/**
 * Lee la descripción de la pantalla cuando se entra a ella con el modo voz activo,
 * y también justo después de activar el modo voz estando en esa pantalla.
 */
export function useLeerPantalla(descripcion: string) {
    const { modoVoz, leer } = useAccesibilidad();

    useEffect(() => {
        // En cola: si se acaba de activar el modo voz, primero termina ese mensaje
        if (modoVoz) leer(descripcion, true);
        // Solo debe volver a leerse cuando cambia el modo voz, no en cada render
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [modoVoz]);
}