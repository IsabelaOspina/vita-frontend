import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Espacio, Radio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';
import { useComandosPantalla } from '@/context/asistente-context';
import type { ActividadSaludResponse } from '@/dto/ActividadSaludResponse';
import type { RecordatorioResponse } from '@/dto/RecordatorioResponse';
import type { TipoRecordatorio } from '@/dto/TipoRecordatorio';
import { cancelarActividad, completarActividad, obtenerActividad } from '@/services/actividadSaludService';
import { cancelarRecordatorio, crearRecordatorio, listarRecordatoriosDeActividad } from '@/services/recordatorioService';
import { aPalabras } from '@/utils/comandos-voz';
import { aDia, aFechaHoraLocal, deFechaLocal, horaCorta } from '@/utils/fechas';
import { dejarAvisoPendiente } from '@/utils/fuente-sintomas';
import { mensajeDeError } from '@/utils/sesion';
import { cuandoActividad, sinPuntoDoble, nombreEstadoActividad, nombreTipoActividad, nombreTipoAviso, TIPOS_AVISO } from '@/utils/salud';

import { accionesComunesVoz } from './acciones-cuenta';
import { Aviso } from './aviso';
import { Boton } from './boton';
import { ControlSegmentado } from './control-segmentado';
import { coloresTipoActividad } from './elemento-actividad';
import { Encabezado } from './encabezado';
import { EstadoCarga } from './estado-carga';
import { FilaDato } from './fila-dato';
import { FondoPantalla } from './fondo-pantalla';
import { OpcionesFiltro } from './opciones-filtro';
import { Tarjeta } from './tarjeta';
import { Texto } from './texto';

/** Cuánto antes llega un recordatorio nuevo (minutos). */
const ANTES = [
    { valor: '30', titulo: '30 minutos antes' },
    { valor: '60', titulo: '1 hora antes' },
    { valor: '1440', titulo: '1 día antes' },
];

const NOMBRE_ESTADO_RECORDATORIO: Record<string, string> = {
    PENDIENTE: 'Programado',
    ENVIADO: 'Enviado',
    CONFIRMADO: 'Visto',
    CANCELADO: 'Cancelado',
};

/**
 * Detalle de una actividad: sus datos, sus recordatorios (agregar y cancelar) y las acciones
 * Marcar como realizada, Editar y Cancelar actividad (cancelar siempre se confirma).
 */
export function PantallaDetalleActividad({ id }: { id: number }) {
    const { anunciar, leer, colores, altoContraste } = useAccesibilidad();

    const [actividad, setActividad] = useState<ActividadSaludResponse | null>(null);
    const [recordatorios, setRecordatorios] = useState<RecordatorioResponse[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [aviso, setAviso] = useState<{ tipo: 'exito' | 'error'; mensaje: string } | null>(null);
    const [trabajando, setTrabajando] = useState(false);
    const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);

    const [antes, setAntes] = useState('60');
    const [tipoAviso, setTipoAviso] = useState<TipoRecordatorio>('VOCAL');
    const [errorRecordatorio, setErrorRecordatorio] = useState<string | null>(null);

    const cargar = useCallback(async () => {
        setCargando(true);
        setError(null);
        try {
            const [a, r] = await Promise.all([obtenerActividad(id), listarRecordatoriosDeActividad(id)]);
            setActividad(a);
            setRecordatorios(r.sort((x, y) => x.fechaHora.localeCompare(y.fechaHora)));
            return a;
        } catch (e) {
            setError(mensajeDeError(e, 'No pudimos cargar la actividad.'));
            return null;
        } finally {
            setCargando(false);
        }
    }, [id]);

    const lectura = (a: ActividadSaludResponse) =>
        `${nombreTipoActividad(a.tipo)}: ${a.nombre}. ${cuandoActividad(a.fechaHora)}${a.ubicacion ? `, en ${a.ubicacion}` : ''}. ` +
        `${nombreEstadoActividad(a.estado)}.${a.descripcion ? ` Nota: ${a.descripcion}.` : ''}`;

    const primeraVezRef = useRef(true);
    useFocusEffect(
        useCallback(() => {
            void cargar().then((a) => {
                if (a && primeraVezRef.current) leer(lectura(a), true);
                primeraVezRef.current = false;
            });
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [cargar]),
    );

    const volver = () => (router.canGoBack() ? router.back() : router.replace('/paciente/salud/agenda'));
    const pendiente = actividad?.estado === 'PENDIENTE';
    const futura = actividad ? deFechaLocal(actividad.fechaHora).getTime() > Date.now() : false;

    const avisar = (tipo: 'exito' | 'error', texto: string) => {
        const mensaje = sinPuntoDoble(texto);
        setAviso({ tipo, mensaje });
        anunciar(mensaje);
    };

    const completar = async () => {
        if (!actividad) return;
        setTrabajando(true);
        try {
            setActividad(await completarActividad(actividad.id));
            avisar('exito', `Listo, marqué ${actividad.nombre} como realizada.`);
        } catch (e) {
            avisar('error', mensajeDeError(e, 'No pudimos marcar la actividad.'));
        } finally {
            setTrabajando(false);
        }
    };

    const cancelar = async () => {
        if (!actividad) return;
        setTrabajando(true);
        try {
            await cancelarActividad(actividad.id);
            const mensaje = `Se canceló ${actividad.nombre}.`;
            anunciar(mensaje);
            dejarAvisoPendiente(mensaje);
            router.dismissTo({ pathname: '/paciente/salud/agenda', params: { dia: aDia(deFechaLocal(actividad.fechaHora)) } });
        } catch (e) {
            avisar('error', mensajeDeError(e, 'No pudimos cancelar la actividad.'));
        } finally {
            setTrabajando(false);
            setConfirmandoCancelar(false);
        }
    };

    const agregarRecordatorio = async (minutos = antes) => {
        if (!actividad) return;
        setErrorRecordatorio(null);
        const cuando = deFechaLocal(actividad.fechaHora);
        const fecha = new Date(cuando.getTime() - Number(minutos) * 60000);
        if (fecha.getTime() <= Date.now()) {
            const mensaje = 'Ese recordatorio quedaría en el pasado. Elige uno más cercano a la actividad.';
            setErrorRecordatorio(mensaje);
            anunciar(mensaje);
            return;
        }
        setTrabajando(true);
        try {
            const nuevo = await crearRecordatorio(actividad.id, {
                fechaHora: aFechaHoraLocal(fecha),
                mensaje: `${actividad.nombre} a las ${horaCorta(cuando)}${actividad.ubicacion ? `, en ${actividad.ubicacion}` : ''}`,
                tipoRecordatorio: tipoAviso,
            });
            setRecordatorios((r) => [...r, nuevo].sort((x, y) => x.fechaHora.localeCompare(y.fechaHora)));
            avisar('exito', `Listo, te lo recordaré ${ANTES.find((a) => a.valor === minutos)?.titulo.toLowerCase()}, con aviso de ${nombreTipoAviso(tipoAviso).toLowerCase()}.`);
        } catch (e) {
            const mensaje = mensajeDeError(e, 'No pudimos crear el recordatorio.');
            setErrorRecordatorio(mensaje);
            anunciar(mensaje);
        } finally {
            setTrabajando(false);
        }
    };

    const quitarRecordatorio = async (r: RecordatorioResponse) => {
        try {
            const cancelado = await cancelarRecordatorio(r.id);
            setRecordatorios((lista) => lista.map((x) => (x.id === r.id ? cancelado : x)));
            avisar('exito', 'Listo, cancelé el recordatorio.');
        } catch (e) {
            avisar('error', mensajeDeError(e, 'No pudimos cancelar el recordatorio.'));
        }
    };

    const activos = recordatorios.filter((r) => r.estado !== 'CANCELADO');
    const fechaRecordatorio = (r: RecordatorioResponse) => cuandoActividad(r.fechaHora);

    useComandosPantalla({
        cargando: cargando,
        titulo: 'Detalle de la actividad',
        descripcion: pendiente
            ? 'Detalle de la actividad. Puedes decir: lee la actividad, recuérdamelo una hora antes, marcar como realizada, editar o cancelar la actividad.'
            : 'Detalle de la actividad. Puedes decir: lee la actividad o volver.',
        ejemplos: ['lee la actividad', 'recuérdamelo una hora antes', 'lee los recordatorios', 'marcar como realizada', 'editar', 'cancelar la actividad'],
        campos: [],
        listas: [
            {
                claves: ['lee los recordatorios', 'recordatorios', 'mis recordatorios'],
                nombre: 'Recordatorios',
                vacia: 'Esta actividad no tiene recordatorios.',
                elementos: activos.map((r) => ({ nombre: fechaRecordatorio(r), detalle: `aviso de ${nombreTipoAviso(r.tipoRecordatorio).toLowerCase()}, ${NOMBRE_ESTADO_RECORDATORIO[r.estado].toLowerCase()}` })),
                acciones: [
                    {
                        frases: ['cancela', 'cancelar', 'quita', 'quitar', 'elimina', 'borra'],
                        noAplica: (i) => (activos[i].estado === 'PENDIENTE' ? null : 'Ese recordatorio ya se envió y no se puede cancelar.'),
                        confirmar: (e) => `¿Cancelo el recordatorio de ${e.nombre.toLowerCase()}?`,
                        ejecutar: (i) => void quitarRecordatorio(activos[i]),
                    },
                ],
            },
        ],
        acciones: [
            { frases: ['lee la actividad', 'leer', 'lee', 'detalle', 'que dice'], etiqueta: 'leer la actividad', ejecutar: () => anunciar(actividad ? lectura(actividad) : 'Todavía estoy cargando la actividad.') },
            ...(pendiente
                ? [
                      {
                          frases: ['marcar como realizada', 'marca como realizada', 'ya fui', 'ya la hice', 'completar', 'realizada', 'completada'],
                          etiqueta: 'marcar como realizada',
                          ejecutar: () => void completar(),
                      },
                      { frases: ['editar', 'edita', 'cambiar', 'cambia', 'modificar'], etiqueta: 'editar la actividad', ejecutar: () => router.push({ pathname: '/paciente/salud/agenda/editar/[id]', params: { id: String(id) } }) },
                      {
                          frases: ['cancelar la actividad', 'cancela la actividad', 'cancelar la cita', 'cancela la cita', 'ya no voy', 'eliminar', 'elimina'],
                          etiqueta: 'cancelar la actividad',
                          confirmar: '¿Seguro que quieres cancelar esta actividad? Sus recordatorios también se cancelan.',
                          ejecutar: () => void cancelar(),
                      },
                  ]
                : []),
            { frases: ['volver', 'atras', 'regresar', 'agenda'], ejecutar: volver },
            ...accionesComunesVoz('USUARIO', anunciar),
        ],
        dictado: (texto) => {
            const t = aPalabras(texto);
            if (!pendiente || !/^(recuerdame|recuerdamelo|avisame|ponme un recordatorio|agrega un recordatorio)/.test(t)) return null;
            const minutos = /(media hora|30 minutos|treinta minutos)/.test(t) ? '30' : /(un dia|1 dia|dia antes)/.test(t) ? '1440' : /(una hora|1 hora)/.test(t) ? '60' : null;
            if (!minutos) return null;
            return [{ tipo: 'accion', indice: -1, accion: { frases: [], ejecutar: () => void agregarRecordatorio(minutos) } }];
        },
    });

    const colorTipo = actividad ? coloresTipoActividad(actividad.tipo, colores, altoContraste) : null;

    return (
        <FondoPantalla>
            <Encabezado volver alVolver={volver} icono="calendario" titulo={actividad?.nombre ?? 'Actividad'} subtitulo={actividad ? cuandoActividad(actividad.fechaHora) : undefined} />

            {aviso && (
                <View style={styles.aviso}>
                    <Aviso tipo={aviso.tipo} mensaje={aviso.mensaje} />
                </View>
            )}

            <EstadoCarga cargando={cargando && !actividad} error={error} reintentar={cargar} hayDatos={!!actividad} />

            {actividad && colorTipo && (
                <>
                    <Tarjeta titulo="Datos" icono="info">
                        <View style={styles.etiquetas}>
                            <View style={[styles.chip, { backgroundColor: colorTipo.fondo, borderColor: colorTipo.color }]}>
                                <Texto variante="etiqueta" peso="700" style={{ color: colorTipo.color }}>
                                    {nombreTipoActividad(actividad.tipo)}
                                </Texto>
                            </View>
                            <View
                                style={[
                                    styles.chip,
                                    {
                                        backgroundColor: pendiente ? colores.superficieSuave : actividad.estado === 'COMPLETADA' ? colores.exitoFondo : colores.errorFondo,
                                        borderColor: 'transparent',
                                    },
                                ]}>
                                <Texto
                                    variante="etiqueta"
                                    peso="700"
                                    style={{ color: pendiente ? colores.textoSecundario : actividad.estado === 'COMPLETADA' ? colores.exito : colores.error }}>
                                    {nombreEstadoActividad(actividad.estado)}
                                </Texto>
                            </View>
                        </View>
                        <FilaDato etiqueta="Cuándo" valor={cuandoActividad(actividad.fechaHora)} icono="reloj" />
                        {actividad.ubicacion ? <FilaDato etiqueta="Lugar" valor={actividad.ubicacion} icono="ubicacion" /> : null}
                        {actividad.descripcion ? <FilaDato etiqueta="Descripción" valor={actividad.descripcion} icono="nota" /> : null}
                        {actividad.fechaHoraCumplimiento ? (
                            <FilaDato etiqueta="Realizada" valor={cuandoActividad(actividad.fechaHoraCumplimiento)} icono="check" />
                        ) : null}
                    </Tarjeta>

                    <Tarjeta titulo="Recordatorios" icono="campana">
                        {activos.length === 0 && (
                            <Texto variante="cuerpo" color="textoSecundario">
                                Esta actividad no tiene recordatorios.
                            </Texto>
                        )}
                        {activos.map((r) => (
                            <View key={r.id} style={[styles.recordatorio, { borderColor: colores.borde }]}>
                                <View style={styles.textos} accessible accessibilityLabel={`Recordatorio ${fechaRecordatorio(r)}, aviso de ${nombreTipoAviso(r.tipoRecordatorio).toLowerCase()}, ${NOMBRE_ESTADO_RECORDATORIO[r.estado].toLowerCase()}`}>
                                    <Texto variante="cuerpo" peso="700">
                                        {fechaRecordatorio(r)}
                                    </Texto>
                                    <Texto variante="pequeno" color="textoSecundario">
                                        Aviso de {nombreTipoAviso(r.tipoRecordatorio).toLowerCase()} · {NOMBRE_ESTADO_RECORDATORIO[r.estado]}
                                    </Texto>
                                </View>
                                {r.estado === 'PENDIENTE' && (
                                    <View style={styles.quitar}>
                                        <Boton titulo="Quitar" variante="secundario" onPress={() => void quitarRecordatorio(r)} pista={`Cancela el recordatorio de ${fechaRecordatorio(r)}`} />
                                    </View>
                                )}
                            </View>
                        ))}

                        {pendiente && futura && (
                            <View style={[styles.nuevo, { borderTopColor: colores.borde }]}>
                                <Texto variante="etiqueta">Agregar un recordatorio</Texto>
                                <OpcionesFiltro etiqueta="Cuándo avisar" opciones={ANTES} valor={antes} onCambiar={setAntes} />
                                <Texto variante="etiqueta">Tipo de aviso</Texto>
                                <ControlSegmentado etiqueta="Tipo de aviso" opciones={TIPOS_AVISO} valor={tipoAviso} onCambiar={setTipoAviso} />
                                {errorRecordatorio ? (
                                    <Texto variante="pequeno" color="error" peso="600">
                                        {errorRecordatorio}
                                    </Texto>
                                ) : null}
                                <Boton titulo="Agregar recordatorio" icono="agregar" variante="secundario" onPress={() => void agregarRecordatorio()} cargando={trabajando} />
                            </View>
                        )}
                    </Tarjeta>

                    {pendiente && (
                        <View style={styles.botones}>
                            <Boton titulo="Marcar como realizada" icono="check" onPress={completar} cargando={trabajando} />
                            <Boton
                                titulo="Editar"
                                icono="editar"
                                variante="secundario"
                                onPress={() => router.push({ pathname: '/paciente/salud/agenda/editar/[id]', params: { id: String(id) } })}
                            />
                            {confirmandoCancelar ? (
                                <View style={[styles.confirmar, { borderColor: colores.error, backgroundColor: colores.errorFondo }]} accessibilityLiveRegion="polite">
                                    <Texto variante="etiqueta">¿Seguro que quieres cancelar esta actividad? Sus recordatorios también se cancelan.</Texto>
                                    <Boton titulo="Sí, cancelar actividad" icono="cancelar" variante="peligro" onPress={cancelar} cargando={trabajando} />
                                    <Boton titulo="No, conservarla" variante="secundario" onPress={() => setConfirmandoCancelar(false)} />
                                </View>
                            ) : (
                                <Boton
                                    titulo="Cancelar actividad"
                                    icono="cancelar"
                                    variante="secundario"
                                    onPress={() => {
                                        setConfirmandoCancelar(true);
                                        anunciar('¿Seguro que quieres cancelar esta actividad? Toca: sí, cancelar actividad.');
                                    }}
                                />
                            )}
                        </View>
                    )}
                </>
            )}
        </FondoPantalla>
    );
}

const styles = StyleSheet.create({
    aviso: {
        marginBottom: Espacio.l,
    },
    etiquetas: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Espacio.s,
    },
    chip: {
        borderRadius: Radio.s,
        borderWidth: 1.5,
        paddingHorizontal: Espacio.m,
        paddingVertical: Espacio.xs,
    },
    recordatorio: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Espacio.m,
        borderWidth: 1.5,
        borderRadius: Radio.m,
        padding: Espacio.m,
    },
    textos: {
        flex: 1,
        gap: 2,
    },
    quitar: {
        minWidth: 96,
    },
    nuevo: {
        gap: Espacio.s,
        borderTopWidth: 1,
        paddingTop: Espacio.m,
    },
    botones: {
        gap: Espacio.m,
        marginBottom: Espacio.xl,
    },
    confirmar: {
        gap: Espacio.m,
        borderWidth: 1.5,
        borderRadius: Radio.m,
        padding: Espacio.m,
    },
});
