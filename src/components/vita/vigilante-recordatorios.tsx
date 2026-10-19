import { requireOptionalNativeModule } from 'expo';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Modal, Platform, StyleSheet, Vibration, View } from 'react-native';

import { AnchoMaximo, Espacio, Radio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';
import { useAsistente } from '@/context/asistente-context';
import type { RecordatorioResponse } from '@/dto/RecordatorioResponse';
import { confirmarRecordatorio, listarAgendaRecordatorios, marcarRecordatorioEnviado } from '@/services/recordatorioService';
import { alCambiarDatos } from '@/utils/cambios-de-datos';
import { aFechaHoraLocal, deFechaLocal, horaCorta } from '@/utils/fechas';
import type { PantallaVoz } from '@/utils/comandos-voz';

import { Boton } from './boton';
import { Icono } from './icono';
import { Texto } from './texto';

// ---------------------------------------------------------------------------------------------
// Notificaciones del celular
// ---------------------------------------------------------------------------------------------

type ModuloNotificaciones = Pick<
    typeof import('expo-notifications'),
    | 'setNotificationHandler'
    | 'setNotificationChannelAsync'
    | 'deleteNotificationChannelAsync'
    | 'getPermissionsAsync'
    | 'requestPermissionsAsync'
    | 'getAllScheduledNotificationsAsync'
    | 'scheduleNotificationAsync'
    | 'cancelScheduledNotificationAsync'
    | 'addNotificationResponseReceivedListener'
    | 'getLastNotificationResponseAsync'
    | 'AndroidImportance'
    | 'AndroidNotificationPriority'
    | 'AndroidNotificationVisibility'
    | 'SchedulableTriggerInputTypes'
>;

/**
 * Carga solo las partes de expo-notifications que usa VITA (notificaciones locales programadas).
 *
 * No se importa el paquete completo a propósito: su archivo principal registra las notificaciones
 * push (remotas), que VITA no usa, y en Expo Go para Android eso muestra la advertencia
 * "Push notifications (remote notifications) are unavailable in Expo Go...". Cargando solo estas
 * partes, las notificaciones locales funcionan en Expo Go, en el development build y en el APK,
 * sin advertencias.
 *
 * En la web no existe, y en un development build creado antes de instalar la librería tampoco:
 * en esos casos la app sigue funcionando y los recordatorios se avisan solo dentro de la app.
 */
function cargarNotificaciones(): ModuloNotificaciones | null {
    if (Platform.OS === 'web' || !requireOptionalNativeModule('ExpoNotificationScheduler')) return null;
    try {
        /* eslint-disable @typescript-eslint/no-require-imports */
        return {
            ...require('expo-notifications/build/NotificationsHandler'),
            ...require('expo-notifications/build/NotificationPermissions'),
            ...require('expo-notifications/build/NotificationsEmitter'),
            setNotificationChannelAsync: require('expo-notifications/build/setNotificationChannelAsync').setNotificationChannelAsync,
            deleteNotificationChannelAsync: require('expo-notifications/build/deleteNotificationChannelAsync').deleteNotificationChannelAsync,
            getAllScheduledNotificationsAsync: require('expo-notifications/build/getAllScheduledNotificationsAsync').getAllScheduledNotificationsAsync,
            scheduleNotificationAsync: require('expo-notifications/build/scheduleNotificationAsync').scheduleNotificationAsync,
            cancelScheduledNotificationAsync: require('expo-notifications/build/cancelScheduledNotificationAsync').cancelScheduledNotificationAsync,
            AndroidImportance: require('expo-notifications/build/NotificationChannelManager.types').AndroidImportance,
            AndroidNotificationVisibility: require('expo-notifications/build/NotificationChannelManager.types').AndroidNotificationVisibility,
            AndroidNotificationPriority: require('expo-notifications/build/Notifications.types').AndroidNotificationPriority,
            SchedulableTriggerInputTypes: require('expo-notifications/build/Notifications.types').SchedulableTriggerInputTypes,
        } as ModuloNotificaciones;
        /* eslint-enable @typescript-eslint/no-require-imports */
    } catch {
        return null;
    }
}

const notificaciones = cargarNotificaciones();

const PREFIJO = 'vita-recordatorio-';
/**
 * Canal de Android de los recordatorios. Es uno solo para los tres tipos de aviso (voz, sonido y
 * visual): con VITA cerrada no se puede hablar ni mostrar el aviso grande, así que todos llegan como
 * notificación con importancia máxima, sonido y vibración, para que se vean siempre y a su hora.
 * El tipo de aviso se respeta dentro de la app (voz, tono o solo pantalla).
 *
 * Android no deja cambiar un canal después de creado; por eso es un canal nuevo y se borran los
 * de versiones anteriores (uno de ellos, el "visual", era silencioso y en algunos celulares no se veía).
 */
const CANAL = 'vita-avisos';
const CANALES_ANTERIORES = ['vita-recordatorios', 'vita-recordatorios-visual'];
/** Si cambia la forma de programar, las notificaciones de versiones anteriores se vuelven a programar. */
const VERSION_PROGRAMACION = 4;
/** Cada cuánto se consulta la agenda de recordatorios al backend. */
const CONSULTA_MS = 30_000;
/** Cada cuánto se revisa si ya llegó la hora de alguno (con lo último que se consultó). */
const REVISION_MS = 5_000;
/** Un recordatorio que se pasó hace menos de esto todavía se avisa (por ejemplo, si la app estaba cerrada). */
const ATRASO_MAXIMO_MS = 15 * 60_000;
/** Hasta cuándo se programan notificaciones en el celular. */
const DIAS_PROGRAMADOS = 14;
/** iOS permite máximo 64 notificaciones programadas por app. */
const MAXIMO_PROGRAMADAS = Platform.OS === 'ios' ? 60 : 300;

if (notificaciones) {
    // Con la app abierta (en pantalla), el aviso grande lo da la propia app (con voz, sonido o solo en
    // pantalla); la notificación queda en la lista del celular sin el globo de arriba. Con la app cerrada,
    // en segundo plano o con la pantalla bloqueada, Android muestra la notificación completa.
    notificaciones.setNotificationHandler({
        handleNotification: async (n) => {
            const soloTono = n.request.content.data?.soloTono === true;
            // Con VITA abierta el aviso grande lo muestra la app; la notificación igual queda en la
            // lista del celular (sin el globo de arriba, para no repetir el aviso)
            return {
                shouldShowBanner: false,
                shouldShowList: !soloTono,
                shouldPlaySound: soloTono,
                shouldSetBadge: false,
            };
        },
    });
}

async function prepararNotificaciones(): Promise<boolean> {
    if (!notificaciones) return false;
    try {
        if (Platform.OS === 'android') {
            // Importancia máxima: la notificación aparece arriba de la pantalla aunque el celular esté bloqueado
            await notificaciones.setNotificationChannelAsync(CANAL, {
                name: 'Recordatorios de VITA',
                description: 'Citas, terapias y tomas de medicamentos',
                importance: notificaciones.AndroidImportance.MAX,
                vibrationPattern: [0, 400, 200, 400],
                sound: 'default',
                enableVibrate: true,
                showBadge: true,
                lockscreenVisibility: notificaciones.AndroidNotificationVisibility.PUBLIC,
            });
            for (const anterior of CANALES_ANTERIORES) {
                await notificaciones.deleteNotificationChannelAsync(anterior).catch(() => undefined);
            }
        }
        const actual = await notificaciones.getPermissionsAsync();
        if (actual.granted) return true;
        if (!actual.canAskAgain) return false;
        return (await notificaciones.requestPermissionsAsync()).granted;
    } catch {
        return false;
    }
}

/** Deja programadas en el celular exactamente las notificaciones de los próximos recordatorios. */
async function sincronizarNotificaciones(proximos: RecordatorioResponse[]) {
    if (!notificaciones) return;
    try {
        const programadas = await notificaciones.getAllScheduledNotificationsAsync();
        const deseadas = new Map(proximos.slice(0, MAXIMO_PROGRAMADAS).map((r) => [`${PREFIJO}${r.id}`, r]));

        // Quita las que ya no corresponden (canceladas, confirmadas o con otra hora)
        for (const p of programadas) {
            if (!p.identifier.startsWith(PREFIJO)) continue;
            const r = deseadas.get(p.identifier);
            if (!r || p.content.data?.fechaHora !== r.fechaHora || p.content.data?.version !== VERSION_PROGRAMACION) {
                await notificaciones.cancelScheduledNotificationAsync(p.identifier);
            } else {
                deseadas.delete(p.identifier);
            }
        }

        // Programa las que faltan (si una falla, se siguen programando las demás)
        for (const [identificador, r] of deseadas) {
            try {
                await notificaciones.scheduleNotificationAsync({
                    identifier: identificador,
                    content: {
                        // Las tomas de medicamentos llegan igual que los recordatorios de actividades
                        title: r.tomaMedicamentoId ? 'VITA · Hora de tu medicamento' : 'VITA · Recordatorio',
                        body: r.mensaje,
                        // Con la app cerrada no se puede hablar ni mostrar el aviso grande: los tres tipos
                        // (voz, sonido y visual) llegan como notificación con sonido, para que siempre se note
                        sound: 'default',
                        priority: notificaciones.AndroidNotificationPriority.MAX,
                        data: { recordatorioId: r.id, fechaHora: r.fechaHora, version: VERSION_PROGRAMACION },
                    },
                    trigger: {
                        type: notificaciones.SchedulableTriggerInputTypes.DATE,
                        date: deFechaLocal(r.fechaHora),
                        channelId: CANAL,
                    },
                });
            } catch {
                // Se intenta de nuevo en la próxima sincronización
            }
        }
    } catch {
        // Si el celular no deja programar, los avisos siguen funcionando dentro de la app
    }
}

/** Si VITA tiene permiso para mostrar notificaciones en este celular. */
export async function permisoDeAvisos(): Promise<'concedido' | 'negado' | 'no-disponible'> {
    if (!notificaciones) return 'no-disponible';
    try {
        return (await notificaciones.getPermissionsAsync()).granted ? 'concedido' : 'negado';
    } catch {
        return 'no-disponible';
    }
}

/** Al cerrar sesión: quita del celular todos los recordatorios de VITA programados. */
export function cancelarRecordatoriosDelCelular(): Promise<void> {
    return cancelarNotificaciones();
}

async function cancelarNotificaciones(ids?: number[]) {
    if (!notificaciones) return;
    try {
        if (ids) {
            for (const id of ids) await notificaciones.cancelScheduledNotificationAsync(`${PREFIJO}${id}`);
            return;
        }
        const programadas = await notificaciones.getAllScheduledNotificationsAsync();
        for (const p of programadas) {
            if (p.identifier.startsWith(PREFIJO)) await notificaciones.cancelScheduledNotificationAsync(p.identifier);
        }
    } catch {
        // Nada que hacer
    }
}

// ---------------------------------------------------------------------------------------------
// Tono (aviso de "Sonido")
// ---------------------------------------------------------------------------------------------

function sonarTono() {
    if (Platform.OS === 'web') {
        try {
            const Contexto =
                (
                    window as unknown as {
                        AudioContext?: typeof AudioContext;
                        webkitAudioContext?: typeof AudioContext;
                    }
                ).AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            if (!Contexto) return;
            const audio = new Contexto();
            // Tres pitidos cortos
            [0, 0.45, 0.9].forEach((inicio) => {
                const oscilador = audio.createOscillator();
                const volumen = audio.createGain();
                oscilador.frequency.value = 880;
                volumen.gain.setValueAtTime(0.0001, audio.currentTime + inicio);
                volumen.gain.exponentialRampToValueAtTime(0.4, audio.currentTime + inicio + 0.02);
                volumen.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + inicio + 0.3);
                oscilador.connect(volumen).connect(audio.destination);
                oscilador.start(audio.currentTime + inicio);
                oscilador.stop(audio.currentTime + inicio + 0.32);
            });
            setTimeout(() => void audio.close(), 1800);
        } catch {
            // El navegador no dejó reproducir sonido
        }
        return;
    }
    Vibration.vibrate([0, 400, 200, 400]);
    // En el celular, el tono es el de las notificaciones del sistema
    if (notificaciones) {
        void notificaciones
            .scheduleNotificationAsync({
                content: {
                    title: 'VITA',
                    body: 'Recordatorio',
                    sound: 'default',
                    data: { soloTono: true },
                },
                trigger: null,
            })
            .catch(() => undefined);
    }
}

// ---------------------------------------------------------------------------------------------
// Vigilante
// ---------------------------------------------------------------------------------------------

/** Lo que se dice y se muestra en el aviso. */
function textoAviso(r: RecordatorioResponse) {
    const mensaje = r.mensaje.trim().replace(/\.$/, '');
    return r.tomaMedicamentoId ? `${mensaje}.` : `Recordatorio: ${mensaje}.`;
}

/**
 * Avisa los recordatorios del paciente cuando llega su hora.
 *
 * - Con la app abierta (web y celular): cada 30 segundos consulta la agenda de recordatorios y, a la hora,
 *   avisa según el tipo: con voz lo dice en voz alta, con sonido suena un tono y siempre muestra un
 *   aviso grande con "Entendido". Al mostrarlo lo marca como enviado y con "Entendido" lo confirma.
 * - Con la app cerrada (solo celular): deja programadas notificaciones del sistema para los próximos
 *   14 días, que llegan aunque VITA no esté abierta (con alarmas exactas, ver los permisos en app.json).
 *
 * Va en el _layout del paciente para que funcione en cualquier pantalla mientras la sesión esté abierta.
 */
export function VigilanteRecordatorios() {
    const { colores, modoVoz } = useAccesibilidad();
    const { avisar, registrarPantalla, pantallaRegistrada } = useAsistente();

    const [cola, setCola] = useState<RecordatorioResponse[]>([]);
    const actual = cola[0] ?? null;

    const agendaRef = useRef<RecordatorioResponse[]>([]);
    const avisadosRef = useRef(new Set<number>());
    const permisoRef = useRef<boolean | null>(null);

    const encolar = useCallback((r: RecordatorioResponse) => {
        if (avisadosRef.current.has(r.id)) return;
        avisadosRef.current.add(r.id);
        setCola((antes) => [...antes, r]);
    }, []);

    /** Revisa con lo último consultado si ya llegó la hora de algún recordatorio. */
    const revisar = useCallback(() => {
        const ahora = Date.now();
        for (const r of agendaRef.current) {
            if (r.estado !== 'PENDIENTE') continue;
            const cuando = deFechaLocal(r.fechaHora).getTime();
            if (cuando <= ahora && ahora - cuando <= ATRASO_MAXIMO_MS) encolar(r);
        }
    }, [encolar]);

    // Evita que dos consultas reprogramen las notificaciones al mismo tiempo: si llega otra mientras
    // una está en curso, se repite una vez al terminar
    const enCursoRef = useRef(false);
    const repetirRef = useRef(false);

    /** Trae la agenda del backend y reprograma las notificaciones del celular. */
    const consultar = useCallback(async (): Promise<void> => {
        if (enCursoRef.current) {
            repetirRef.current = true;
            return;
        }
        enCursoRef.current = true;
        try {
            await consultarAhora();
        } finally {
            enCursoRef.current = false;
        }
        if (repetirRef.current) {
            repetirRef.current = false;
            await consultar();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const consultarAhora = async () => {
        const ahora = new Date();
        const desde = new Date(ahora.getTime() - ATRASO_MAXIMO_MS);
        const hasta = new Date(ahora.getTime() + DIAS_PROGRAMADOS * 24 * 60 * 60_000);
        try {
            const agenda = await listarAgendaRecordatorios(aFechaHoraLocal(desde), aFechaHoraLocal(hasta));
            agendaRef.current = agenda;
            revisar();
            if (notificaciones) {
                // La primera vez se pide el permiso; si lo negaron, solo se revisa (sin volver a preguntar)
                // por si la persona lo activó después en los ajustes del celular
                if (permisoRef.current === null) permisoRef.current = await prepararNotificaciones();
                else if (!permisoRef.current) permisoRef.current = (await permisoDeAvisos()) === 'concedido';
                if (permisoRef.current) {
                    const proximos = agenda.filter((r) => r.estado === 'PENDIENTE' && deFechaLocal(r.fechaHora).getTime() > Date.now());
                    await sincronizarNotificaciones(proximos);
                }
            }
        } catch {
            // Sin conexión o sesión vencida: se intenta de nuevo en la próxima consulta
        }
    };

    // Consulta al entrar, cada 30 segundos, cada vez que la app vuelve a primer plano o pasa a segundo
    // plano, y en cuanto se crea, edita o cancela algo (para que el aviso quede programado en el celular
    // aunque la persona cierre VITA enseguida)
    useEffect(() => {
        void consultar();
        const consulta = setInterval(() => void consultar(), CONSULTA_MS);
        const revision = setInterval(revisar, REVISION_MS);
        const estado = AppState.addEventListener('change', (e) => {
            if (e === 'active' || e === 'background') void consultar();
        });
        const quitarOyente = alCambiarDatos(() => void consultar());
        return () => {
            clearInterval(consulta);
            clearInterval(revision);
            estado.remove();
            quitarOyente();
        };
    }, [consultar, revisar]);

    // Ojo: aquí NO se cancelan las notificaciones al desmontar. En Android, salir de la app con el botón
    // "atrás" también desmonta esta pantalla, y se perderían todos los recordatorios con la app cerrada.
    // Se cancelan solo al cerrar sesión (ver cancelarRecordatoriosDelCelular).

    // Si se toca una notificación del celular, al abrir la app se muestra su aviso
    useEffect(() => {
        if (!notificaciones) return;
        const alTocar = (respuesta: {
            notification: {
                request: { content: { data?: Record<string, unknown> } };
            };
        }) => {
            const id = Number(respuesta.notification.request.content.data?.recordatorioId);
            if (!id) return;
            const r = agendaRef.current.find((x) => x.id === id);
            if (r && r.estado === 'PENDIENTE') encolar(r);
            else void consultar();
        };
        const suscripcion = notificaciones.addNotificationResponseReceivedListener(alTocar);
        void notificaciones
            .getLastNotificationResponseAsync()
            .then((r) => r && alTocar(r))
            .catch(() => undefined);
        return () => suscripcion.remove();
    }, [consultar, encolar]);

    // ----- Mostrar el aviso ---------------------------------------------------------------------

    const cerrar = useCallback((r: RecordatorioResponse, confirmar: boolean) => {
        if (confirmar) void confirmarRecordatorio(r.id).catch(() => undefined);
        agendaRef.current = agendaRef.current.map((x) =>
            x.id === r.id ? { ...x, estado: confirmar ? 'CONFIRMADO' : 'ENVIADO' } : x,
        ) as RecordatorioResponse[];
        setCola((antes) => antes.slice(1));
    }, []);

    const ver = useCallback(
        (r: RecordatorioResponse) => {
            cerrar(r, true);
            if (r.actividadSaludId)
                router.push({
                    pathname: '/paciente/salud/agenda/[id]',
                    params: { id: String(r.actividadSaludId) },
                });
            else router.push('/paciente/salud/hoy');
        },
        [cerrar],
    );

    // Órdenes de voz mientras el aviso está abierto: "entendido", "ver"
    const pantallaAviso = useRef<PantallaVoz>({
        titulo: 'Recordatorio',
        descripcion: '',
        ejemplos: [],
        campos: [],
        acciones: [],
    });
    const anteriorRef = useRef<ReturnType<typeof pantallaRegistrada>>(null);

    useEffect(() => {
        if (!actual) return;

        void marcarRecordatorioEnviado(actual.id).catch(() => undefined);
        void cancelarNotificaciones([actual.id]);

        const texto = textoAviso(actual);
        const verTexto = actual.tomaMedicamentoId ? 'ver mis tomas de hoy' : 'ver la actividad';
        pantallaAviso.current = {
            titulo: 'Recordatorio',
            descripcion: `${texto} Di entendido para cerrarlo, o ${verTexto}.`,
            ejemplos: ['entendido', verTexto],
            campos: [],
            acciones: [
                {
                    frases: ['entendido', 'ok', 'listo', 'ya', 'gracias', 'confirmar', 'cerrar', 'vale'],
                    etiqueta: 'cerrar el recordatorio',
                    ejecutar: () => cerrar(actual, true),
                },
                {
                    frases: ['ver', 'abrir', 'ver la actividad', 'ver mis tomas', 'ir'],
                    etiqueta: verTexto,
                    ejecutar: () => ver(actual),
                },
            ],
        };
        const anterior = pantallaRegistrada();
        if (anterior !== pantallaAviso) anteriorRef.current = anterior;
        registrarPantalla(pantallaAviso, false);

        if (actual.tipoRecordatorio === 'SONORA') sonarTono();
        if (actual.tipoRecordatorio === 'VOCAL' || modoVoz) {
            // Con el modo voz activo, todos los recordatorios se leen (también los de sonido y visuales)
            if (actual.tipoRecordatorio === 'SONORA') setTimeout(() => avisar(pantallaAviso.current.descripcion), 1500);
            else avisar(modoVoz ? pantallaAviso.current.descripcion : texto);
        } else if (Platform.OS !== 'web' && actual.tipoRecordatorio === 'VISUAL') {
            Vibration.vibrate(300);
        }

        return () => {
            // Devuelve el asistente a la pantalla en la que estaba la persona
            if (pantallaRegistrada() === pantallaAviso && anteriorRef.current) registrarPantalla(anteriorRef.current, false);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [actual?.id]);

    if (!actual) return null;

    const hora = horaCorta(deFechaLocal(actual.fechaHora));
    const esToma = !!actual.tomaMedicamentoId;

    return (
        <Modal transparent animationType="fade" visible onRequestClose={() => cerrar(actual, true)} accessibilityViewIsModal>
            <View style={[styles.velo, { backgroundColor: 'rgba(0,0,0,0.55)' }]}>
                <View
                    accessibilityRole="alert"
                    accessibilityLiveRegion="assertive"
                    style={[
                        styles.tarjeta,
                        {
                            backgroundColor: colores.superficie,
                            borderColor: colores.primario,
                        },
                    ]}
                >
                    <View style={[styles.icono, { backgroundColor: colores.superficieSuave }]}>
                        <Icono nombre={esToma ? 'medicamento' : 'campana'} tamano={40} color={colores.primario} />
                    </View>
                    <Texto variante="etiqueta" color="primario" peso="800" centrado>
                        {esToma ? `Medicamento · ${hora}` : `Recordatorio · ${hora}`}
                    </Texto>
                    <Texto variante="subtitulo" peso="800" centrado>
                        {actual.mensaje}
                    </Texto>
                    {cola.length > 1 && (
                        <Texto variante="pequeno" color="textoSecundario" centrado>
                            {cola.length - 1 === 1 ? 'Hay 1 recordatorio más' : `Hay ${cola.length - 1} recordatorios más`}
                        </Texto>
                    )}
                    <View style={styles.botones}>
                        <Boton titulo="Entendido" icono="check" onPress={() => cerrar(actual, true)} pista="Cierra el recordatorio y lo marca como visto" />
                        <Boton titulo={esToma ? 'Ver mis tomas de hoy' : 'Ver la actividad'} variante="secundario" onPress={() => ver(actual)} />
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    velo: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: Espacio.l,
    },
    tarjeta: {
        width: '100%',
        maxWidth: AnchoMaximo,
        alignItems: 'center',
        gap: Espacio.m,
        borderWidth: 3,
        borderRadius: Radio.l,
        padding: Espacio.xl,
    },
    icono: {
        width: 76,
        height: 76,
        borderRadius: 38,
        alignItems: 'center',
        justifyContent: 'center',
    },
    botones: {
        alignSelf: 'stretch',
        gap: Espacio.s,
        marginTop: Espacio.s,
    },
});