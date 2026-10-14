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
    aPalabras,
    ajustarValor,
    deletrear,
    interpretarVarias,
    limpiarBordes,
    separarActivacion,
    type AccionVoz,
    type CampoVoz,
    type PantallaVoz,
    type PasoOpcional,
    type Resultado,
} from '@/utils/comandos-voz';
import {
    abrirGrupo,
    alCambiarHabla,
    callar,
    cambiarVelocidad,
    cerrarGrupo,
    estaHablando,
    hablar,
    repetir,
    tiempoDesdeQueCallo,
    ultimoMensaje,
} from '@/utils/voz';

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
 * development build, en el APK y en la versión web (Chrome y Edge).
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

/**
 * Brave tiene el reconocimiento de voz "de mentiras": existe, pero nunca escucha
 * (falla con error de red porque bloquea el servicio de Google que hace el trabajo).
 */
function esBrave(): boolean {
    return Platform.OS === 'web' && typeof navigator !== 'undefined' && 'brave' in navigator;
}

function hayReconocimiento(): boolean {
    if (esBrave()) return false;
    try {
        return !!reconocimiento?.ExpoSpeechRecognitionModule.isRecognitionAvailable();
    } catch {
        return false;
    }
}

/** Idioma en que se escucha: español de Colombia. */
const IDIOMA_ESCUCHA = 'es-CO';

/** Después de cada respuesta (o de "Oye VITA"), cuánto tiempo se escucha sin pedir "Oye VITA" otra vez. */
const ESPERA_RESPUESTA_MS = 10000;

/**
 * Silencio que se espera antes de responder. Si lo dicho ya es una orden completa se responde
 * casi de inmediato; si parece incompleto ("la contraseña es…", un correo sin arroba) se espera
 * más, para no interrumpir a quien hace una pausa al hablar.
 */
const PAUSA_COMPLETA_MS = 450;
const PAUSA_INCOMPLETA_MS = 1400;

/** Tiempo entre que la app deja de hablar y se vuelve a encender el micrófono (para no oír el final de su propia voz). */
const ESPERA_MICROFONO_MS = 250;

/** Palabras que se le sugieren al reconocedor del celular para que las entienda mejor. */
const PALABRAS_CLAVE = [
    'Oye VITA', 'VITA', 'arroba', 'punto com', 'gmail', 'hotmail', 'outlook', 'contraseña', 'correo',
    'cédula', 'iniciar sesión', 'crear cuenta', 'contacto de emergencia', 'parentesco', 'deletrea',
];

/** Respuestas que confirman una pregunta de sí o no. */
const SI = /^(si|claro|dale|de una|ok|okey|okay|hazlo|listo|correcto|adelante|por favor|si por favor|si claro|si señor|eso)$/;
const NO = /^(no|todavia no|aun no|espera|despues|ahora no|no gracias)$/;

/** Errores con los que no tiene sentido seguir intentando escuchar. */
const ERRORES_GRAVES: Partial<Record<string, string>> = {
    'not-allowed': 'Necesito permiso para usar el micrófono. Actívalo en los ajustes.',
    'service-not-allowed': 'El reconocimiento de voz no está permitido en este dispositivo.',
    'language-not-supported': 'Tu dispositivo no tiene disponible el reconocimiento de voz en español.',
    'audio-capture': 'No pude usar el micrófono. Revisa que no lo esté usando otra aplicación.',
    // En la web, el reconocimiento usa un servicio en internet que algunos navegadores bloquean
    ...(Platform.OS === 'web' && {
        network: 'No pude usar el reconocimiento de voz. Revisa tu internet, o abre VITA en Google Chrome o Microsoft Edge.',
    }),
};

// ---------------------------------------------------------------------------------------------
// Ayudas para las respuestas
// ---------------------------------------------------------------------------------------------

const preguntaDe = (campo: CampoVoz) => campo.pregunta ?? `Dime: ${campo.etiqueta}`;
const nombreDeAccion = (accion: AccionVoz) => accion.etiqueta ?? accion.frases[0];

/** Los números se leen cifra por cifra ("3 0 0…"), no como "trescientos millones…". */
const leerValor = (campo: CampoVoz, valor: string) => (campo.tipo === 'numero' ? valor.split('').join(' ') : valor);

/**
 * El siguiente campo por el que conviene preguntar: primero los obligatorios vacíos.
 * Si se acaba de llenar uno opcional (por ejemplo el nombre del contacto), sigue con los
 * opcionales que van después (el teléfono y el parentesco).
 */
function siguienteCampo(pantalla: PantallaVoz, recienLlenos: Set<string>, ultimo: CampoVoz | null): CampoVoz | null {
    const vacio = (c: CampoVoz) => !c.valor && !recienLlenos.has(c.etiqueta);
    const obligatorio = pantalla.campos.find((c) => !c.opcional && vacio(c));
    if (obligatorio) return obligatorio;
    if (ultimo?.opcional) {
        const posicion = pantalla.campos.findIndex((c) => c.etiqueta === ultimo.etiqueta);
        return pantalla.campos.slice(posicion + 1).find((c) => c.opcional && vacio(c)) ?? null;
    }
    return null;
}

/** ¿Ya se cumplió el paso opcional (ya llenó esos campos o ya eligió alguna opción)? */
function pasoCumplido(pantalla: PantallaVoz, paso: PasoOpcional): boolean {
    if (paso.campos?.length) {
        return paso.campos.every((etiqueta) => pantalla.campos.find((c) => c.etiqueta === etiqueta)?.valor);
    }
    if (paso.opciones) return (pantalla.opciones ?? []).some((o) => o.marcada);
    return false;
}

/**
 * ¿Lo que se escuchó es el final de lo que la app acaba de decir? (pasa cuando el micrófono
 * alcanza a oír los parlantes). Se reconoce porque son las mismas palabras, seguidas.
 */
function esEco(texto: string): boolean {
    if (tiempoDesdeQueCallo() > 3000) return false;
    const oidas = aPalabras(texto);
    if (oidas.split(' ').length < 2) return false;
    // El eco es el final de lo que dijo la app (lo último que alcanzó a oír el micrófono). Si la
    // persona repite una orden que VITA sugirió en medio de su mensaje, no es eco
    const dicho = aPalabras(ultimoMensaje());
    const posicion = dicho.lastIndexOf(oidas);
    return posicion >= 0 && dicho.length - (posicion + oidas.length) <= 12;
}

// ---------------------------------------------------------------------------------------------
// Contexto
// ---------------------------------------------------------------------------------------------

/**
 * - apagado: modo voz inactivo, o asistente no disponible
 * - esperando: escuchando, a la espera de "Oye VITA"
 * - atento: escucha órdenes sin necesidad de decir "Oye VITA"
 * - hablando: la app está hablando (el micrófono se pausa para no escucharse a sí misma)
 */
export type EstadoAsistente = 'apagado' | 'esperando' | 'atento' | 'hablando';

type RefPantalla = MutableRefObject<PantallaVoz>;

type Asistente = {
    /** false en Expo Go o en navegadores sin reconocimiento de voz (por ejemplo Firefox o Brave). */
    disponible: boolean;
    estado: EstadoAsistente;
    /** Igual que decir "Oye VITA": interrumpe lo que esté diciendo y queda esperando una orden. */
    prestarAtencion: () => void;
    /** Al entrar a una pantalla. Con `leer`, lee su descripción y pregunta por el primer dato que falta. */
    registrarPantalla: (ref: RefPantalla, leer: boolean) => void;
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
    /** Al terminar la respuesta actual, se escucha sin "Oye VITA" durante un tiempo. */
    const seguimientoRef = useRef(false);
    const temporizadorEstadoRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    /** Lo que lleva dicho la persona en la frase actual (cada parte con sus posibles interpretaciones). */
    const fraseRef = useRef<{ partes: string[][]; atento: boolean } | null>(null);
    const pausaRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    /** Campo por el que VITA acaba de preguntar: la próxima respuesta es su valor. */
    const campoPendienteRef = useRef<string | null>(null);
    /**
     * Pregunta de sí o no que VITA acaba de hacer: ofrecer la acción principal ("¿Quieres crear
     * la cuenta?") o un paso opcional ("¿Quieres agregar un contacto de emergencia?").
     */
    const confirmarRef = useRef<
        { tipo: 'accion' | 'paso'; indice: number } | { tipo: 'funcion'; ejecutar: () => void } | null
    >(null);
    /** Siguiente paso opcional que falta ofrecer en esta pantalla. */
    const pasoRef = useRef(0);
    /** Cuántas veces seguidas no entendió. */
    const fallosRef = useRef(0);

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

    /** Deja al asistente escuchando órdenes sin "Oye VITA" durante un tiempo. */
    const abrirVentana = useCallback(() => {
        atentoHastaRef.current = Date.now() + ESPERA_RESPUESTA_MS;
        actualizarEstado();
        if (temporizadorEstadoRef.current) clearTimeout(temporizadorEstadoRef.current);
        // Al terminar la espera, vuelve a mostrar "Di Oye VITA"
        temporizadorEstadoRef.current = setTimeout(actualizarEstado, ESPERA_RESPUESTA_MS + 100);
    }, [actualizarEstado]);

    const empezarEscucha = useCallback(() => {
        if (!reconocimiento || !activoRef.current || escuchandoRef.current || estaHablando()) return;
        escuchandoRef.current = true;
        try {
            reconocimiento.ExpoSpeechRecognitionModule.start({
                lang: IDIOMA_ESCUCHA,
                interimResults: true,
                continuous: true,
                // Varias interpretaciones de lo dicho: se usa la primera que tenga sentido
                maxAlternatives: 3,
                addsPunctuation: false,
                contextualStrings: PALABRAS_CLAVE,
            });
        } catch {
            // Por ejemplo, si el navegador aún no soltó el micrófono anterior: el vigilante reintenta
            escuchandoRef.current = false;
        }
        actualizarEstado();
    }, [actualizarEstado]);

    /** Pregunta por el siguiente dato que falta. Devuelve false si no falta nada. */
    const preguntarSiguiente = useCallback((recienLlenos: Set<string>, ultimo: CampoVoz | null, enCola: boolean) => {
        const pantalla = pantallaActual();
        if (!pantalla) return false;
        const campo = siguienteCampo(pantalla, recienLlenos, ultimo);
        if (campo) {
            hablar(preguntaDe(campo), enCola);
            campoPendienteRef.current = campo.etiqueta;
            return true;
        }
        return false;
    }, []);

    /** Ofrece la acción principal de la pantalla cuando ya está todo lleno. */
    const ofrecerAccion = useCallback(() => {
        const pantalla = pantallaActual();
        const accion = pantalla?.acciones[0];
        // Solo en formularios: en las demás pantallas no hay una acción "principal" que ofrecer
        if (!accion || !pantalla.campos.length) return false;
        hablar(`Todo listo. Responde sí o no: ¿quieres ${nombreDeAccion(accion)}?`);
        confirmarRef.current = { tipo: 'accion', indice: 0 };
        return true;
    }, []);

    /**
     * Qué sigue en la pantalla: el siguiente dato obligatorio; cuando ya están todos, cada paso
     * opcional ("¿Quieres agregar un contacto de emergencia?"); y al final, la acción principal.
     * Devuelve false si no hay nada que preguntar.
     */
    const continuarFlujo = useCallback(
        (recienLlenos: Set<string>, ultimo: CampoVoz | null, enCola: boolean) => {
            if (preguntarSiguiente(recienLlenos, ultimo, enCola)) return true;
            const pantalla = pantallaActual();
            const pasos = pantalla?.pasosOpcionales ?? [];
            while (pantalla && pasoRef.current < pasos.length) {
                const indice = pasoRef.current;
                pasoRef.current += 1;
                if (pasoCumplido(pantalla, pasos[indice])) continue;
                hablar(pasos[indice].pregunta, enCola);
                confirmarRef.current = { tipo: 'paso', indice };
                return true;
            }
            return ofrecerAccion();
        },
        [ofrecerAccion, preguntarSiguiente],
    );

    /** Dijo que sí a un paso opcional: se piden sus campos o se pregunta cuál opción. */
    const aceptarPaso = useCallback((indice: number) => {
        const pantalla = pantallaActual();
        const paso = pantalla?.pasosOpcionales?.[indice];
        confirmarRef.current = null;
        if (!pantalla || !paso) return;
        const campo = pantalla.campos.find((c) => paso.campos?.includes(c.etiqueta) && !c.valor);
        if (campo) {
            hablar(preguntaDe(campo));
            campoPendienteRef.current = campo.etiqueta;
        } else {
            hablar(paso.siAcepta ?? '¿Cuál?');
        }
        seguimientoRef.current = true;
    }, []);

    /** Igual que decir "Oye VITA" sin orden: lo dice en voz alta y espera la orden. */
    const quedarAtento = useCallback(() => {
        seguimientoRef.current = true;
        abrirVentana();
        hablar('Dime');
    }, [abrirVentana]);

    // ----- Ejecutar órdenes ---------------------------------------------------------------------

    /** Ejecuta una orden. Lo que se dice va con hablar(), que dentro de un grupo se junta en un solo mensaje. */
    const ejecutarUna = useCallback(
        (resultado: Resultado) => {
            const a = accesibilidadRef.current;
            const pantalla = pantallaActual();

            switch (resultado.tipo) {
                case 'ayuda': {
                    // Ayuda útil: dónde está, y empieza a pedir lo que falta, uno por uno
                    if (pantalla?.titulo) hablar(`Estás en ${pantalla.titulo}`);
                    if (pantalla && !pantalla.campos.length && pantalla.ejemplos.length) {
                        hablar(`Puedes decir: ${pantalla.ejemplos.slice(0, 4).join('. ')}`);
                    }
                    hablar('Para escuchar todas las órdenes, di: más opciones');
                    if (!continuarFlujo(new Set(), null, false)) hablar('¿Qué quieres hacer?');
                    break;
                }
                case 'masAyuda': {
                    const ejemplos = pantalla?.ejemplos ?? [];
                    hablar(
                        (ejemplos.length ? `Aquí puedes decir: ${ejemplos.join('. ')}. ` : '') +
                        'Puedes decir varias cosas seguidas, unidas con "y". ' +
                        'También: qué falta, deletrea la contraseña, borra el correo, repite, ' +
                        'habla más rápido o más despacio, alto contraste, aumenta el texto, o desactiva el modo voz.',
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
                    const llenos = pantalla.campos
                        .filter((c) => c.valor)
                        // La contraseña nunca se lee en voz alta (para eso está "deletrea la contraseña")
                        .map((c) => (c.tipo === 'contrasena' ? `${c.etiqueta}: escrita` : `${c.etiqueta}: ${leerValor(c, c.valor)}`));
                    const faltan = pantalla.campos.filter((c) => !c.valor && !c.opcional).map((c) => c.etiqueta);
                    const marcadas = (pantalla.opciones ?? []).filter((o) => o.marcada).map((o) => o.etiqueta);
                    hablar(
                        [
                            llenos.length ? llenos.join('. ') : 'No has escrito nada todavía',
                            faltan.length ? `Falta: ${faltan.join(', ')}` : 'No falta nada obligatorio',
                            marcadas.length ? `Seleccionaste: ${marcadas.join(', ')}` : '',
                        ]
                            .filter(Boolean)
                            .join('. '),
                    );
                    break;
                }
                case 'contraste':
                    a.alternarContraste();
                    break;
                case 'texto':
                    if (!a.cambiarTamanoTexto(resultado.cambio)) {
                        hablar(resultado.cambio === 'aumentar' ? 'El texto ya está en el tamaño máximo' : 'El texto ya está en el tamaño normal');
                    }
                    break;
                case 'velocidad': {
                    const cambio = resultado.cambio;
                    if (cambiarVelocidad(cambio)) hablar(cambio === 'mas' ? 'Listo, hablaré más rápido' : 'Listo, hablaré más despacio');
                    else hablar(cambio === 'mas' ? 'Ya estoy en la velocidad máxima' : 'Ya estoy en la velocidad mínima');
                    break;
                }
                case 'repetir':
                    // Se atiende aparte, en ejecutarVarias, para repetir exactamente lo anterior
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
                            ? `Contraseña lista, ${resultado.valor.length} caracteres`
                            : `${resultado.campo.etiqueta}: ${leerValor(resultado.campo, resultado.valor)}`,
                    );
                    break;
                case 'pedirCampo':
                    hablar(preguntaDe(resultado.campo));
                    campoPendienteRef.current = resultado.campo.etiqueta;
                    break;
                case 'borrarCampo':
                    resultado.campo.asignar('');
                    hablar(`${resultado.campo.etiqueta} borrado`);
                    break;
                case 'deletrear':
                    hablar(
                        resultado.campo.valor
                            ? `${resultado.campo.etiqueta}: ${deletrear(resultado.campo.valor)}`
                            : `${resultado.campo.etiqueta} está vacío`,
                    );
                    break;
                case 'opcion': {
                    const { opcion, marcar } = resultado;
                    if (opcion.marcada === marcar) {
                        hablar(`${opcion.etiqueta} ya estaba ${marcar ? 'seleccionada' : 'sin seleccionar'}`);
                    } else {
                        opcion.cambiar(marcar);
                        hablar(`${opcion.etiqueta} ${marcar ? 'seleccionada' : 'quitada'}`);
                    }
                    break;
                }
                case 'leerLista': {
                    const { lista } = resultado;
                    if (!lista.elementos.length) {
                        hablar(lista.vacia);
                        break;
                    }
                    const cantidad = lista.elementos.length;
                    hablar(
                        `${lista.nombre}: ${cantidad === 1 ? 'hay uno' : `hay ${cantidad}`}. ` +
                        lista.elementos
                            .map((e, i) => `${i + 1}: ${e.nombre}${e.detalle ? `, ${e.detalle}` : ''}`)
                            .join('. '),
                    );
                    break;
                }
                case 'accionElemento': {
                    const { lista, accion, indice } = resultado;
                    const noAplica = accion.noAplica?.(indice);
                    if (noAplica) {
                        hablar(noAplica);
                        break;
                    }
                    // Las acciones delicadas (desactivar, quitar una asignación) se confirman antes
                    if (accion.confirmar) {
                        hablar(`Responde sí o no. ${accion.confirmar(lista.elementos[indice])}`);
                        confirmarRef.current = { tipo: 'funcion', ejecutar: () => accion.ejecutar(indice) };
                    }
                    // Las demás se ejecutan en ejecutarVarias, después de los campos
                    break;
                }
                case 'elementoNoEncontrado':
                    hablar(`No encontré a ${resultado.buscado} en ${resultado.lista.nombre.toLowerCase()}. Puedes decir: ${resultado.lista.claves[0]}, para escucharla.`);
                    break;
                case 'accion':
                case 'noEntendido':
                    // Se atienden en ejecutarVarias
                    break;
            }
        },
        [continuarFlujo],
    );

    /**
     * Ejecuta todas las órdenes de una frase y responde con un solo mensaje corto,
     * que termina diciendo qué sigue (una pregunta, o "¿algo más?") para que la persona sepa
     * que puede responder sin decir "Oye VITA".
     */
    const ejecutarVarias = useCallback(
        (resultados: Resultado[]) => {
            const entendidos = resultados.filter((r) => r.tipo !== 'noEntendido');
            const accionesPantalla = resultados.filter((r): r is Extract<Resultado, { tipo: 'accion' }> => r.tipo === 'accion');
            // Acciones sobre elementos que se hacen de una vez (sin confirmar), por ejemplo "ver a Ana"
            const accionesElemento = resultados.filter(
                (r): r is Extract<Resultado, { tipo: 'accionElemento' }> =>
                    r.tipo === 'accionElemento' && !r.accion.confirmar && !r.accion.noAplica?.(r.indice),
            );
            const acciones = [...accionesPantalla, ...accionesElemento];
            campoPendienteRef.current = null;
            confirmarRef.current = null;

            // "repite" repite lo último dicho tal cual
            if (resultados.length === 1 && resultados[0].tipo === 'repetir') {
                if (!repetir()) hablar('Todavía no he dicho nada');
                seguimientoRef.current = true;
                return;
            }

            // No entendió nada: la primera vez pide que lo repita (y escucha sin "Oye VITA");
            // si vuelve a fallar, deja de insistir para que el ruido de fondo no provoque respuestas en cadena
            if (entendidos.length === 0) {
                fallosRef.current += 1;
                if (fallosRef.current === 1) {
                    hablar('No te entendí. Si lo necesitas, pide ayuda. ¿Me lo repites?');
                    seguimientoRef.current = true;
                } else {
                    hablar('No te entendí. Cuando quieras, di: Oye VITA, ayuda.');
                    fallosRef.current = 0;
                }
                return;
            }
            fallosRef.current = 0;

            abrirGrupo();
            for (const resultado of resultados) {
                // Si hay una acción, se omiten las confirmaciones de cada campo: la acción responde por sí
                // misma (por ejemplo "Revisa el formulario: la contraseña debe tener…" o "Bienvenido")
                if (acciones.length && resultado.tipo === 'campo') {
                    resultado.campo.asignar(resultado.valor);
                    continue;
                }
                ejecutarUna(resultado);
            }

            const recienLlenos = new Set(resultados.flatMap((r) => (r.tipo === 'campo' ? [r.campo.etiqueta] : [])));
            const ultimo = resultados[resultados.length - 1];
            const termino = resultados.some((r) => r.tipo === 'callar' || r.tipo === 'apagar');

            const terminar = () => {
                // Qué sigue: el siguiente dato, ofrecer la acción principal, o "¿algo más?"
                let pregunto = campoPendienteRef.current !== null || confirmarRef.current !== null;
                if (!pregunto && !acciones.length && (ultimo.tipo === 'campo' || ultimo.tipo === 'opcion')) {
                    pregunto = continuarFlujo(recienLlenos, ultimo.tipo === 'campo' ? ultimo.campo : null, false);
                }
                if (!pregunto && !acciones.length && !termino && ultimo.tipo !== 'masAyuda') hablar('¿Algo más?');
                cerrarGrupo();
                if (!activoRef.current || termino) return;
                seguimientoRef.current = true;
                if (!estaHablando()) abrirVentana();
            };

            if (!acciones.length) {
                terminar();
                return;
            }
            setTimeout(() => {
                // Se busca la acción en la versión más reciente de la pantalla (con los valores ya escritos)
                const pantalla = pantallaActual();
                for (const { accion, indice } of accionesPantalla) {
                    (pantalla?.acciones[indice] ?? accion).ejecutar();
                }
                for (const { accion, indice } of accionesElemento) accion.ejecutar(indice);
                terminar();
            }, 120);
        },
        [abrirVentana, continuarFlujo, ejecutarUna],
    );

    // ----- Procesar lo que se escuchó ----------------------------------------------------------

    const procesar = useCallback(
        (alternativas: string[], atento: boolean) => {
            // El micrófono alcanzó a oír la voz de la app: se ignora
            if (esEco(alternativas[0])) return;

            const pantalla = pantallaActual();
            let soloActivacion = false;
            let mejor: { resultados: Resultado[]; entendidos: number } | null = null;

            // Se prueba cada interpretación del reconocedor y se queda la que mejor se entiende
            for (const texto of alternativas) {
                const resto = separarActivacion(texto, !atento);
                // Sin "Oye VITA" y fuera del tiempo de respuesta: es conversación normal, se ignora
                const orden = resto ?? (atento ? limpiarBordes(texto) : null);
                if (orden === null) continue;
                if (!orden) {
                    soloActivacion = true;
                    continue;
                }

                // Respuesta a una pregunta de sí o no ("¿Quieres crear la cuenta?", "¿Quieres agregar un contacto?")
                const palabras = aPalabras(orden);
                const pregunta = confirmarRef.current;
                if (pregunta && pantalla) {
                    if (SI.test(palabras)) {
                        if (pregunta.tipo === 'funcion') {
                            // Confirmó una acción delicada: la pantalla dice el resultado
                            confirmarRef.current = null;
                            pregunta.ejecutar();
                            seguimientoRef.current = true;
                            return;
                        }
                        if (pregunta.tipo === 'paso') {
                            aceptarPaso(pregunta.indice);
                            return;
                        }
                        const accion = pantalla.acciones[pregunta.indice];
                        if (accion) {
                            mejor = { resultados: [{ tipo: 'accion', accion, indice: pregunta.indice }], entendidos: 1 };
                            break;
                        }
                    }
                    if (NO.test(palabras)) {
                        confirmarRef.current = null;
                        abrirGrupo();
                        hablar('Está bien');
                        // Si dijo que no a un paso opcional, sigue con el siguiente (o con la acción principal)
                        if (pregunta.tipo !== 'paso' || !continuarFlujo(new Set(), null, false)) hablar('¿Algo más?');
                        cerrarGrupo();
                        seguimientoRef.current = true;
                        return;
                    }
                }

                let resultados = interpretarVarias(orden, pantalla);

                // Respuesta a "¿Cuál es tu contraseña?": lo dicho es el valor del campo
                const pendiente = pantalla?.campos.find((c) => c.etiqueta === campoPendienteRef.current);
                if (pendiente && resultados.every((r) => r.tipo === 'noEntendido')) {
                    const valor = ajustarValor(orden.replace(/^(es|son|se llama|seria|sera)\s+/i, ''), pendiente.tipo);
                    if (valor) resultados = [{ tipo: 'campo', campo: pendiente, valor }];
                }

                const entendidos = resultados.filter((r) => r.tipo !== 'noEntendido').length;
                if (!mejor || entendidos > mejor.entendidos) mejor = { resultados, entendidos };
                if (entendidos === resultados.length) break;
            }

            if (!mejor) {
                if (soloActivacion) quedarAtento();
                return;
            }
            atentoHastaRef.current = 0;
            ejecutarVarias(mejor.resultados);
            actualizarEstado();
        },
        [aceptarPaso, actualizarEstado, continuarFlujo, ejecutarVarias, quedarAtento],
    );

    /** ¿Lo dicho ya es una orden completa? Así se responde rápido sin cortar a quien sigue hablando. */
    const pareceCompleto = useCallback((texto: string, atento: boolean) => {
        const resto = separarActivacion(texto, !atento);
        const orden = resto ?? (atento ? limpiarBordes(texto) : null);
        // Conversación sin "Oye VITA" (se ignora) o solo "Oye VITA" (responde "Dime")
        if (orden === null || !orden) return true;
        if (confirmarRef.current && (SI.test(aPalabras(orden)) || NO.test(aPalabras(orden)))) return true;
        const resultados = interpretarVarias(orden, pantallaActual());
        if (resultados.some((r) => r.tipo === 'pedirCampo')) return false;
        if (resultados.every((r) => r.tipo === 'noEntendido')) return campoPendienteRef.current !== null;
        const ultimo = resultados[resultados.length - 1];
        if (ultimo.tipo === 'campo') {
            // Un correo sin arroba o un número corto suelen ser una pausa a mitad del dato
            if (ultimo.campo.tipo === 'correo') return /@.+\./.test(ultimo.valor);
            if (ultimo.campo.tipo === 'numero') return ultimo.valor.length >= 7;
        }
        return true;
    }, []);

    // ----- Eventos del micrófono y de la voz -----------------------------------------------------

    useEffect(() => {
        if (!reconocimiento) return;
        const modulo = reconocimiento.ExpoSpeechRecognitionModule;

        /**
         * El reconocedor da la frase por terminada en cuanto la persona hace una pausa corta
         * (por ejemplo, para recordar su correo). Por eso no se responde de inmediato: se espera
         * a que pase un momento sin hablar y se junta todo lo dicho en una sola orden.
         */
        const esperarPausa = () => {
            if (pausaRef.current) clearTimeout(pausaRef.current);
            const frase = fraseRef.current;
            if (!frase?.partes.length) {
                // Aún no hay nada terminado: se espera lo normal
                pausaRef.current = setTimeout(() => (pausaRef.current = null), PAUSA_INCOMPLETA_MS);
                return;
            }
            // Lo dicho antes se toma tal cual; de la última parte se prueban todas sus interpretaciones
            const inicio = frase.partes.slice(0, -1).map((alternativas) => alternativas[0]).join(' ');
            const textos = frase.partes[frase.partes.length - 1].map((t) => `${inicio} ${t}`.trim());
            const espera = pareceCompleto(textos[0], frase.atento) ? PAUSA_COMPLETA_MS : PAUSA_INCOMPLETA_MS;
            pausaRef.current = setTimeout(() => {
                pausaRef.current = null;
                fraseRef.current = null;
                if (activoRef.current) procesar(textos, frase.atento);
            }, espera);
        };

        const suscripciones = [
            modulo.addListener('result', (evento) => {
                const alternativas = evento.results.map((r) => r.transcript).filter((t) => t.trim());
                if (!alternativas.length) return;

                // Si estaba en el tiempo de respuesta cuando empezó a hablar, cuenta aunque termine después
                if (!fraseRef.current) fraseRef.current = { partes: [], atento: Date.now() < atentoHastaRef.current };
                const frase = fraseRef.current;

                if (!evento.isFinal) {
                    // Apenas se oye "Oye VITA" el botón cambia a "Te escucho…", aunque la persona siga hablando
                    if (!frase.atento && alternativas.some((t) => separarActivacion(t) !== null)) setEstado('atento');
                    // Sigue hablando: se aplaza la respuesta
                    if (pausaRef.current) esperarPausa();
                    return;
                }
                frase.partes.push(alternativas);
                esperarPausa();
            }),
            modulo.addListener('error', (evento) => {
                // "aborted" es normal: pasa cada vez que se apaga el micrófono para que hable la app
                const grave = ERRORES_GRAVES[evento.error];
                if (grave) {
                    activoRef.current = false;
                    hablar(grave);
                    actualizarEstado();
                }
                // Los demás errores (no se escuchó nada, etc.) se recuperan al reiniciar en "end"
            }),
            modulo.addListener('end', () => {
                escuchandoRef.current = false;
                // El reconocedor se detiene solo cada cierto tiempo: si el asistente sigue activo, se reinicia
                if (activoRef.current) setTimeout(empezarEscucha, 100);
            }),
        ];

        const dejarDeOirHabla = alCambiarHabla((hablandoAhora) => {
            if (hablandoAhora && escuchandoRef.current) {
                // Mientras la app habla, se apaga el micrófono para que no se escuche a sí misma.
                // Se marca apagado de una vez, sin esperar el aviso "end" (a veces no llega)
                escuchandoRef.current = false;
                modulo.abort();
            } else if (!hablandoAhora && activoRef.current) {
                // Terminó de responder: el tiempo para contestar sin "Oye VITA" empieza ahora
                if (seguimientoRef.current || Date.now() < atentoHastaRef.current) {
                    seguimientoRef.current = false;
                    abrirVentana();
                }
                setTimeout(empezarEscucha, ESPERA_MICROFONO_MS);
            }
            actualizarEstado();
        });

        return () => {
            suscripciones.forEach((s) => s.remove());
            dejarDeOirHabla();
        };
    }, [abrirVentana, actualizarEstado, empezarEscucha, pareceCompleto, procesar]);

    // Vigilante: si el asistente está activo, la app no habla y el micrófono quedó apagado
    // (porque el navegador no avisó que terminó algo), lo vuelve a encender
    useEffect(() => {
        const vigilante = setInterval(() => {
            if (activoRef.current && !escuchandoRef.current && !estaHablando()) empezarEscucha();
        }, 3000);
        return () => clearInterval(vigilante);
    }, [empezarEscucha]);

    // ----- Encender y apagar con el modo voz ----------------------------------------------------

    useEffect(() => {
        const descripcion = pantallaActual()?.descripcion;

        if (!modoVoz) {
            activoRef.current = false;
            atentoHastaRef.current = 0;
            seguimientoRef.current = false;
            campoPendienteRef.current = null;
            confirmarRef.current = null;
            if (escuchandoRef.current) {
                escuchandoRef.current = false;
                reconocimiento?.ExpoSpeechRecognitionModule.abort();
            }
            actualizarEstado();
            return;
        }

        if (!disponible || !reconocimiento) {
            hablar(
                esBrave()
                    ? 'Modo voz activado. Te leeré los campos y los mensajes. El navegador Brave no permite el asistente Oye VITA: para usarlo, abre VITA en Google Chrome o Microsoft Edge.'
                    : 'Modo voz activado. Te leeré los campos y los mensajes. En este dispositivo no está disponible el asistente Oye VITA.',
            );
            if (descripcion) hablar(descripcion, true);
            return;
        }

        const empezar = () => {
            activoRef.current = true;
            const pantalla = pantallaActual();
            pasoRef.current = 0;
            hablar(`Modo voz activado. Di Oye VITA cuando me necesites, o pide ayuda. ${pantalla?.titulo ?? ''}.`);
            // Empieza a pedir los datos de la pantalla; si no falta nada, pregunta qué quiere hacer
            if (!continuarFlujo(new Set(), null, true)) hablar('¿Qué quieres hacer?', true);
            seguimientoRef.current = true;
        };

        // En la web el navegador pide el permiso del micrófono al empezar a escuchar
        if (Platform.OS === 'web') {
            empezar();
            return;
        }

        let cancelado = false;
        reconocimiento.ExpoSpeechRecognitionModule.requestPermissionsAsync().then((permiso) => {
            if (cancelado) return;
            if (!permiso.granted) {
                hablar('Modo voz activado, pero sin permiso de micrófono no puedo escuchar órdenes. Actívalo en los ajustes.');
                return;
            }
            empezar();
        });

        return () => {
            cancelado = true;
        };
    }, [modoVoz, disponible, actualizarEstado, continuarFlujo]);

    const prestarAtencion = useCallback(() => {
        if (!activoRef.current) return;
        // Interrumpe lo que esté diciendo
        if (estaHablando()) callar();
        quedarAtento();
    }, [quedarAtento]);

    // ----- Atajos de teclado (versión web) -------------------------------------------------------

    useEffect(() => {
        if (Platform.OS !== 'web' || typeof window === 'undefined') return;
        const alPresionar = (evento: KeyboardEvent) => {
            // Alt + V: activa el modo voz si está apagado, o equivale a decir "Oye VITA"
            if (evento.altKey && evento.code === 'KeyV') {
                evento.preventDefault();
                if (!accesibilidadRef.current.modoVoz) accesibilidadRef.current.alternarModoVoz();
                else prestarAtencion();
                return;
            }
            // Escape: hace callar a VITA
            if (evento.key === 'Escape' && estaHablando()) callar();
        };
        window.addEventListener('keydown', alPresionar);
        return () => window.removeEventListener('keydown', alPresionar);
    }, [prestarAtencion]);

    const valor: Asistente = {
        disponible,
        estado,
        prestarAtencion,
        registrarPantalla: (ref, leer) => {
            pantallaRef.current = ref;
            campoPendienteRef.current = null;
            confirmarRef.current = null;
            pasoRef.current = 0;
            if (!leer) return;
            if (activoRef.current) {
                // En los formularios solo se dice el nombre de la pantalla (la descripción completa
                // se escucha con "lee la pantalla") y se empieza a pedir lo que falta
                const esFormulario = ref.current.campos.length > 0;
                // Las pantallas sin formulario terminan con una pregunta, para que se sepa que VITA escucha
                hablar(esFormulario ? (ref.current.titulo ?? ref.current.descripcion) : `${ref.current.descripcion} ¿Qué quieres hacer?`, true);
                continuarFlujo(new Set(), null, true);
                seguimientoRef.current = true;
            } else {
                hablar(ref.current.descripcion, true);
            }
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
 * Además, si el modo voz está activo, al entrar a la pantalla se lee su descripción
 * y el asistente pregunta por el primer dato que falta.
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
            registrarPantalla(ref, modoVozRef.current);
            return () => quitarPantalla(ref);
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []),
    );
}