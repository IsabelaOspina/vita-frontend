import { requireOptionalNativeModule } from 'expo';
import { useFocusEffect } from 'expo-router';
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
    type MutableRefObject,
    type ReactNode,
} from 'react';
import { Platform } from 'react-native';

import { useAccesibilidad } from '@/context/accesibilidad-context';
import {
    interpretar,
    limpiarBordes,
    separarActivacion,
    type PantallaVoz,
    type Resultado,
} from '@/utils/comandos-voz';
import { alCambiarHabla, callar, estaHablando, hablar } from '@/utils/voz';

// ---------------------------------------------------------------------------------------------
// Carga del reconocimiento de voz
// ---------------------------------------------------------------------------------------------

type ModuloReconocimiento = typeof import('expo-speech-recognition');

/**
 * Carga expo-speech-recognition solo si está disponible.
 *
 * Expo Go no trae este módulo nativo, y la librería lanza un error apenas se importa.
 * Por eso no se importa arriba del archivo: así la app sigue abriendo en Expo Go
 * (el modo voz lee en voz alta, pero sin asistente) y el asistente funciona en un
 * development build, en el APK y en la versión web (Chrome, Edge y Safari).
 */
function cargarReconocimiento(): ModuloReconocimiento | null {
    if (Platform.OS !== 'web' && !requireOptionalNativeModule('ExpoSpeechRecognition')) {
        return null;
    }
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        return require('expo-speech-recognition') as ModuloReconocimiento;
    } catch {
        return null;
    }
}

const reconocimiento = cargarReconocimiento();

function hayReconocimiento(): boolean {
    try {
        return !!reconocimiento?.ExpoSpeechRecognitionModule.isRecognitionAvailable();
    } catch {
        return false;
    }
}

/** Idioma en que se escucha: español de Colombia. */
const IDIOMA_ESCUCHA = 'es-CO';

/** Después de "Oye VITA" sin orden, cuánto tiempo se espera la orden sin repetir "Oye VITA". */
const ESPERA_ORDEN_MS = 10000;

/** Errores con los que no tiene sentido seguir intentando escuchar. */
const ERRORES_GRAVES: Partial<Record<string, string>> = {
    'not-allowed': 'Necesito permiso para usar el micrófono. Actívalo en los ajustes del celular.',
    'service-not-allowed': 'El reconocimiento de voz no está permitido en este dispositivo.',
    'language-not-supported': 'Tu dispositivo no tiene disponible el reconocimiento de voz en español.',
    'audio-capture': 'No pude usar el micrófono. Revisa que no lo esté usando otra aplicación.',
};

// ---------------------------------------------------------------------------------------------
// Contexto
// ---------------------------------------------------------------------------------------------

/**
 * - apagado: modo voz inactivo, o asistente no disponible
 * - esperando: escuchando, a la espera de "Oye VITA"
 * - atento: ya dijeron "Oye VITA", esperando la orden
 * - hablando: la app está hablando (el micrófono se pausa para no escucharse a sí misma)
 */
export type EstadoAsistente = 'apagado' | 'esperando' | 'atento' | 'hablando';

type RefPantalla = MutableRefObject<PantallaVoz>;

type Asistente = {
    /** false en Expo Go o en navegadores sin reconocimiento de voz (por ejemplo Firefox). */
    disponible: boolean;
    estado: EstadoAsistente;
    /** Igual que decir "Oye VITA": deja al asistente esperando una orden. */
    prestarAtencion: () => void;
    registrarPantalla: (ref: RefPantalla) => void;
    quitarPantalla: (ref: RefPantalla) => void;
};

const AsistenteContext = createContext<Asistente | null>(null);

export function AsistenteProvider({ children }: { children: ReactNode }) {
    const accesibilidad = useAccesibilidad();
    const { modoVoz } = accesibilidad;

    const [disponible, setDisponible] = useState(false);
    const [estado, setEstado] = useState<EstadoAsistente>('apagado');

    // Referencias para que los eventos del micrófono siempre vean los valores actuales
    const accesibilidadRef = useRef(accesibilidad);
    accesibilidadRef.current = accesibilidad;
    const pantallaRef = useRef<RefPantalla | null>(null);
    const activoRef = useRef(false);
    const escuchandoRef = useRef(false);
    const atentoHastaRef = useRef(0);

    // Se detecta al abrir la app (no durante el render) para que la versión web generada
    // de antemano coincida con lo que muestra el navegador
    useEffect(() => {
        setDisponible(hayReconocimiento());
    }, []);

    const pantallaActual = () => pantallaRef.current?.current ?? null;

    const actualizarEstado = useCallback(() => {
        if (!activoRef.current) setEstado('apagado');
        else if (estaHablando()) setEstado('hablando');
        else if (Date.now() < atentoHastaRef.current) setEstado('atento');
        else setEstado('esperando');
    }, []);

    const empezarEscucha = useCallback(() => {
        if (!reconocimiento || !activoRef.current || escuchandoRef.current || estaHablando()) return;
        escuchandoRef.current = true;
        reconocimiento.ExpoSpeechRecognitionModule.start({
            lang: IDIOMA_ESCUCHA,
            interimResults: false,
            continuous: true,
            addsPunctuation: false,
        });
        actualizarEstado();
    }, [actualizarEstado]);

    const quedarAtento = useCallback(() => {
        atentoHastaRef.current = Date.now() + ESPERA_ORDEN_MS;
        hablar('Te escucho');
        actualizarEstado();
        // Al terminar la espera, vuelve a mostrar "Di Oye VITA"
        setTimeout(actualizarEstado, ESPERA_ORDEN_MS + 100);
    }, [actualizarEstado]);

    // ----- Ejecutar una orden -----------------------------------------------------------------

    const ejecutar = useCallback((resultado: Resultado) => {
        const a = accesibilidadRef.current;
        const pantalla = pantallaActual();

        switch (resultado.tipo) {
            case 'ayuda': {
                const ejemplos = pantalla?.ejemplos ?? [];
                hablar(
                    'Primero di Oye VITA, y luego la orden. ' +
                    (ejemplos.length ? `En esta pantalla puedes decir: ${ejemplos.join('. ')}. ` : '') +
                    'En cualquier pantalla: lee la pantalla, qué falta, activa el alto contraste, ' +
                    'aumenta o disminuye el texto, o desactiva el modo voz.',
                );
                break;
            }
            case 'leerPantalla':
                hablar(pantalla?.descripcion ?? 'No hay información de esta pantalla.');
                break;
            case 'leerFormulario': {
                if (!pantalla || pantalla.campos.length === 0) {
                    hablar('En esta pantalla no hay campos para llenar.');
                    break;
                }
                const partes = pantalla.campos.map((campo) => {
                    if (!campo.valor) return `${campo.etiqueta}: vacío`;
                    // La contraseña nunca se lee en voz alta
                    if (campo.tipo === 'contrasena') return `${campo.etiqueta}: escrita`;
                    return `${campo.etiqueta}: ${campo.valor}`;
                });
                const marcadas = (pantalla.opciones ?? []).filter((o) => o.marcada).map((o) => o.etiqueta);
                if (pantalla.opciones?.length) {
                    partes.push(marcadas.length ? `Seleccionaste: ${marcadas.join(', ')}` : 'No seleccionaste opciones');
                }
                hablar(partes.join('. '));
                break;
            }
            case 'contraste':
                a.alternarContraste();
                break;
            case 'texto':
                if (!a.cambiarTamanoTexto(resultado.cambio)) {
                    hablar(resultado.cambio === 'aumentar' ? 'El texto ya está en su tamaño máximo' : 'El texto ya está en su tamaño normal');
                }
                break;
            case 'apagar':
                activoRef.current = false;
                a.alternarModoVoz();
                hablar('Modo voz desactivado. Hasta pronto');
                break;
            case 'callar':
                callar();
                break;
            case 'campo':
                resultado.campo.asignar(resultado.valor);
                hablar(
                    resultado.campo.tipo === 'contrasena'
                        ? `Contraseña escrita. Tiene ${resultado.valor.length} caracteres`
                        : `${resultado.campo.etiqueta}: ${resultado.valor}`,
                );
                break;
            case 'borrarCampo':
                resultado.campo.asignar('');
                hablar(`${resultado.campo.etiqueta}: borrado`);
                break;
            case 'opcion': {
                const { opcion, marcar } = resultado;
                if (opcion.marcada === marcar) {
                    hablar(`${opcion.etiqueta} ya estaba ${marcar ? 'seleccionada' : 'sin seleccionar'}`);
                } else {
                    opcion.cambiar(marcar);
                    hablar(`${opcion.etiqueta}: ${marcar ? 'seleccionada' : 'quitada'}`);
                }
                break;
            }
            case 'accion':
                // La pantalla anuncia el resultado (errores, bienvenida, etc.)
                resultado.accion.ejecutar();
                break;
            default:
                hablar('No te entendí. Di: Oye VITA, qué puedo decir, para escuchar las opciones.');
        }
    }, []);

    // ----- Procesar lo que se escuchó ----------------------------------------------------------

    const procesar = useCallback(
        (texto: string) => {
            const resto = separarActivacion(texto);
            const atento = Date.now() < atentoHastaRef.current;

            let orden: string;
            if (atento) {
                // Ya habían dicho "Oye VITA": todo lo que digan ahora es la orden
                orden = resto ?? limpiarBordes(texto);
            } else if (resto === null) {
                // Conversación normal sin "Oye VITA": se ignora
                return;
            } else {
                orden = resto;
            }

            atentoHastaRef.current = 0;
            if (!orden) {
                quedarAtento();
                return;
            }
            ejecutar(interpretar(orden, pantallaActual()));
            actualizarEstado();
        },
        [actualizarEstado, ejecutar, quedarAtento],
    );

    // ----- Eventos del micrófono y de la voz -----------------------------------------------------

    useEffect(() => {
        if (!reconocimiento) return;
        const modulo = reconocimiento.ExpoSpeechRecognitionModule;

        const suscripciones = [
            modulo.addListener('result', (evento) => {
                if (!evento.isFinal) return;
                const texto = evento.results[0]?.transcript ?? '';
                if (texto.trim()) procesar(texto);
            }),
            modulo.addListener('error', (evento) => {
                const grave = ERRORES_GRAVES[evento.error];
                if (grave) {
                    activoRef.current = false;
                    hablar(grave);
                    actualizarEstado();
                }
                // Los demás errores (no se escuchó nada, red, etc.) se recuperan al reiniciar en "end"
            }),
            modulo.addListener('end', () => {
                escuchandoRef.current = false;
                // El reconocedor se detiene solo cada cierto tiempo: si el asistente sigue activo, se reinicia
                if (activoRef.current) setTimeout(empezarEscucha, 400);
            }),
        ];

        const dejarDeOirHabla = alCambiarHabla((hablandoAhora) => {
            if (hablandoAhora && escuchandoRef.current) {
                // Mientras la app habla, se apaga el micrófono para que no se escuche a sí misma
                modulo.abort();
            } else if (!hablandoAhora) {
                setTimeout(empezarEscucha, 300);
            }
            actualizarEstado();
        });

        return () => {
            suscripciones.forEach((s) => s.remove());
            dejarDeOirHabla();
        };
    }, [actualizarEstado, empezarEscucha, procesar]);

    // ----- Encender y apagar con el modo voz ----------------------------------------------------

    useEffect(() => {
        const descripcion = pantallaActual()?.descripcion;

        if (!modoVoz) {
            activoRef.current = false;
            atentoHastaRef.current = 0;
            if (escuchandoRef.current) reconocimiento?.ExpoSpeechRecognitionModule.abort();
            actualizarEstado();
            return;
        }

        if (!disponible || !reconocimiento) {
            hablar('Modo voz activado. Te leeré los campos y los mensajes. En este dispositivo no está disponible el asistente Oye VITA.');
            if (descripcion) hablar(descripcion, true);
            return;
        }

        let cancelado = false;
        reconocimiento.ExpoSpeechRecognitionModule.requestPermissionsAsync().then((permiso) => {
            if (cancelado) return;
            if (!permiso.granted) {
                hablar('Modo voz activado, pero sin permiso de micrófono no puedo escuchar órdenes. Actívalo en los ajustes del celular.');
                return;
            }
            activoRef.current = true;
            hablar('Modo voz activado. Para usar el asistente, di: Oye VITA, y lo que quieras hacer. Por ejemplo: Oye VITA, qué puedo decir.');
            if (descripcion) hablar(descripcion, true);
            // La escucha empieza sola cuando la app termina de hablar
        });

        return () => {
            cancelado = true;
        };
    }, [modoVoz, disponible, actualizarEstado]);

    const valor: Asistente = {
        disponible,
        estado,
        prestarAtencion: () => {
            if (activoRef.current) quedarAtento();
        },
        registrarPantalla: (ref) => {
            pantallaRef.current = ref;
        },
        quitarPantalla: (ref) => {
            if (pantallaRef.current === ref) pantallaRef.current = null;
        },
    };

    return <AsistenteContext.Provider value={valor}>{children}</AsistenteContext.Provider>;
}

export function useAsistente() {
    const contexto = useContext(AsistenteContext);
    if (!contexto) {
        throw new Error('useAsistente debe usarse dentro de <AsistenteProvider>');
    }
    return contexto;
}

/**
 * Cada pantalla le dice al asistente qué campos, opciones y acciones tiene.
 * Mientras la pantalla está abierta, las órdenes de "Oye VITA" se aplican sobre ella.
 * Además, si el modo voz está activo, al entrar a la pantalla se lee su descripción.
 */
export function useComandosPantalla(pantalla: PantallaVoz) {
    const { registrarPantalla, quitarPantalla } = useAsistente();
    const { modoVoz } = useAccesibilidad();

    // Siempre con los valores más recientes de la pantalla (lo escrito en cada campo, etc.)
    const ref = useRef(pantalla);
    ref.current = pantalla;
    const modoVozRef = useRef(modoVoz);
    modoVozRef.current = modoVoz;

    useFocusEffect(
        useCallback(() => {
            registrarPantalla(ref);
            if (modoVozRef.current) hablar(ref.current.descripcion, true);
            return () => quitarPantalla(ref);
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []),
    );
}