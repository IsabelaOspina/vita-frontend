import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Espacio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';
import { useComandosPantalla } from '@/context/asistente-context';
import type { ActividadSaludResponse } from '@/dto/ActividadSaludResponse';
import type { TomaMedicamentoResponse } from '@/dto/TomaMedicamentoResponse';
import { completarActividad, listarActividadesPorDia } from '@/services/actividadSaludService';
import { marcarTomaTomada } from '@/services/TomaMedicamentoService';
import { aDia, deFechaLocal, horaCorta } from '@/utils/fechas';
import { mensajeDeError } from '@/utils/sesion';
import { actividadVigente, diaLargo, nombreTipoActividad, rangoDelDia, sinPuntoDoble, tomaPorMarcar, tomaVigente } from '@/utils/salud';
import { tomasEntre } from '@/utils/tomas';

import { accionesComunesVoz } from './acciones-cuenta';
import { Aviso } from './aviso';
import { ElementoActividad } from './elemento-actividad';
import { ElementoToma } from './elemento-toma';
import { Encabezado } from './encabezado';
import { EstadoCarga } from './estado-carga';
import { FondoPantalla } from './fondo-pantalla';
import { Icono } from './icono';
import { Tarjeta } from './tarjeta';
import { Texto } from './texto';

/** Lo de hoy: tomas de medicamentos y actividades del día. Lo usan "Hoy" y el resumen de "Mi salud". */
export async function datosDeHoy(): Promise<{ tomas: TomaMedicamentoResponse[]; actividades: ActividadSaludResponse[]; medicamentosActivos: number }> {
    const hoy = new Date();
    const { desde, hasta } = rangoDelDia(hoy);
    const [{ tomas, medicamentos }, actividades] = await Promise.all([tomasEntre(desde, hasta), listarActividadesPorDia(aDia(hoy))]);
    return {
        tomas,
        actividades: actividades.filter((a) => a.estado !== 'CANCELADA').sort((a, b) => a.fechaHora.localeCompare(b.fechaHora)),
        medicamentosActivos: medicamentos.length,
    };
}

/** "Hoy": las tomas del día con "Ya lo tomé" y las actividades del día con "Marcar como realizada". */
export function PantallaHoy() {
    const { anunciar, colores } = useAccesibilidad();

    const [tomas, setTomas] = useState<TomaMedicamentoResponse[]>([]);
    const [actividades, setActividades] = useState<ActividadSaludResponse[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [marcando, setMarcando] = useState<number | null>(null);
    const [aviso, setAviso] = useState<{ tipo: 'exito' | 'error'; mensaje: string } | null>(null);
    const [verPasado, setVerPasado] = useState(false);
    // Se recalcula al cargar y cada minuto, para que lo que va pasando salga de la lista
    const [ahora, setAhora] = useState(() => Date.now());

    const cargar = useCallback(async () => {
        setCargando(true);
        setError(null);
        try {
            const datos = await datosDeHoy();
            setTomas(datos.tomas);
            setActividades(datos.actividades);
            setAhora(Date.now());
        } catch (e) {
            setError(mensajeDeError(e, 'No pudimos cargar lo de hoy.'));
        } finally {
            setCargando(false);
        }
    }, []);

    const cargarRef = useRef(cargar);
    cargarRef.current = cargar;
    useFocusEffect(
        useCallback(() => {
            void cargarRef.current();
            const reloj = setInterval(() => setAhora(Date.now()), 60_000);
            return () => clearInterval(reloj);
        }, []),
    );

    const marcarTomada = async (toma: TomaMedicamentoResponse) => {
        setMarcando(toma.id);
        try {
            const actualizada = await marcarTomaTomada(toma.id);
            setTomas((antes) => antes.map((t) => (t.id === toma.id ? actualizada : t)));
            const mensaje = `Listo, registré ${toma.medicamentoNombre} de las ${horaCorta(deFechaLocal(toma.fechaHora))} como tomado.`;
            setAviso({ tipo: 'exito', mensaje });
            anunciar(mensaje);
        } catch (e) {
            const mensaje = mensajeDeError(e, 'No pudimos registrar la toma.');
            setAviso({ tipo: 'error', mensaje });
            anunciar(mensaje);
        } finally {
            setMarcando(null);
        }
    };

    const completar = async (actividad: ActividadSaludResponse) => {
        try {
            const actualizada = await completarActividad(actividad.id);
            setActividades((antes) => antes.map((a) => (a.id === actividad.id ? actualizada : a)));
            const mensaje = `Listo, marqué ${actividad.nombre} como realizada.`;
            setAviso({ tipo: 'exito', mensaje });
            anunciar(mensaje);
        } catch (e) {
            const mensaje = mensajeDeError(e, 'No pudimos marcar la actividad.');
            setAviso({ tipo: 'error', mensaje });
            anunciar(mensaje);
        }
    };

    // Arriba solo lo que todavía viene; lo que ya pasó queda plegado en "Ya pasó hoy"
    const tomasVigentes = tomas.filter((t) => tomaVigente(t, ahora));
    const tomasPasadas = tomas.filter((t) => !tomaVigente(t, ahora));
    const actividadesVigentes = actividades.filter((a) => actividadVigente(a, ahora));
    const actividadesPasadas = actividades.filter((a) => !actividadVigente(a, ahora));
    const cuantasPasaron = tomasPasadas.length + actividadesPasadas.length;

    const pendientes = tomasVigentes.filter(tomaPorMarcar);
    const tomadas = tomas.filter((t) => !tomaPorMarcar(t)).length;
    const hora = (t: string) => horaCorta(deFechaLocal(t));

    /** "Ya me tomé el losartán": marca la próxima toma pendiente de ese medicamento. */
    const tomaPorNombre = (texto: string) => {
        const t = texto.toLowerCase();
        return pendientes.find((p) => t.includes(p.medicamentoNombre.toLowerCase()));
    };

    useComandosPantalla({
        cargando: cargando,
        titulo: 'Hoy',
        descripcion: sinPuntoDoble(
            `Hoy. ${pendientes.length === 0 ? 'No te faltan más tomas' : `Te ${pendientes.length === 1 ? 'falta 1 toma' : `faltan ${pendientes.length} tomas`}`}` +
                ` y ${actividadesVigentes.length === 0 ? 'no tienes más actividades' : `tienes ${actividadesVigentes.length === 1 ? '1 actividad más' : `${actividadesVigentes.length} actividades más`}`}. ` +
                'Puedes decir: lee mis medicamentos, ya me tomé y el nombre del medicamento, o lee mis actividades.',
        ),
        ejemplos: ['lee mis medicamentos', 'ya me tomé el losartán', 'lee mis actividades', 'ir a la agenda'],
        campos: [],
        listas: [
            {
                claves: ['lee mis medicamentos', 'medicamentos de hoy', 'tomas de hoy', 'mis tomas', 'que me falta', 'lee las tomas'],
                nombre: 'Medicamentos de hoy',
                vacia: 'Por hoy no tienes más medicamentos programados.',
                elementos: tomasVigentes.map((t) => ({
                    nombre: t.medicamentoNombre,
                    detalle: `${hora(t.fechaHora)}${t.dosis ? `, ${t.dosis}` : ''}, ${tomaPorMarcar(t) ? 'pendiente' : 'ya registrado'}`,
                })),
                acciones: [
                    {
                        frases: ['ya me tome', 'ya tome', 'me tome', 'marca como tomado', 'tomado', 'ya lo tome', 'listo'],
                        noAplica: (i) =>
                            tomaPorMarcar(tomasVigentes[i])
                                ? null
                                : `${tomasVigentes[i].medicamentoNombre} de las ${hora(tomasVigentes[i].fechaHora)} ya estaba registrado.`,
                        ejecutar: (i) => void marcarTomada(tomasVigentes[i]),
                    },
                ],
            },
            {
                claves: ['lee mis actividades', 'actividades de hoy', 'mis citas de hoy', 'citas de hoy', 'que citas tengo'],
                nombre: 'Actividades de hoy',
                vacia: 'Por hoy no tienes más actividades.',
                elementos: actividadesVigentes.map((a) => ({
                    nombre: a.nombre,
                    detalle: `${nombreTipoActividad(a.tipo).toLowerCase()}, ${hora(a.fechaHora)}${a.ubicacion ? `, en ${a.ubicacion}` : ''}`,
                })),
                acciones: [
                    {
                        frases: ['abre', 'abrir', 'ver', 'detalle de'],
                        ejecutar: (i) => router.push({ pathname: '/paciente/salud/agenda/[id]', params: { id: String(actividadesVigentes[i].id) } }),
                    },
                    {
                        frases: ['marca como realizada', 'ya fui', 'ya la hice', 'completar', 'realizada'],
                        noAplica: (i) => (actividadesVigentes[i].estado === 'PENDIENTE' ? null : `${actividadesVigentes[i].nombre} ya no está pendiente.`),
                        ejecutar: (i) => void completar(actividadesVigentes[i]),
                    },
                ],
            },
        ],
        acciones: [
            {
                frases: ['que ya paso', 'lo que ya paso', 'lo de esta manana', 'ver lo pasado', 'lo anterior'],
                ejecutar: () => {
                    setVerPasado(true);
                    anunciar(
                        sinPuntoDoble(
                            cuantasPasaron === 0
                                ? 'Todavía no ha pasado nada hoy.'
                                : `Ya pasó hoy: ${[
                                      ...tomasPasadas.map(
                                          (t) => `${t.medicamentoNombre} a las ${hora(t.fechaHora)}, ${tomaPorMarcar(t) ? 'sin registrar' : 'registrado'}`,
                                      ),
                                      ...actividadesPasadas.map((a) => `${a.nombre} a las ${hora(a.fechaHora)}`),
                                  ].join('; ')}.`,
                        ),
                    );
                },
            },
            {
                frases: ['ya me tome la siguiente', 'ya me tome la proxima', 'ya me la tome'],
                ejecutar: () => (pendientes[0] ? void marcarTomada(pendientes[0]) : anunciar('No tienes tomas pendientes hoy.')),
            },
            { frases: ['volver', 'atras', 'regresar'], ejecutar: () => (router.canGoBack() ? router.back() : router.replace('/paciente/salud')) },
            ...accionesComunesVoz('USUARIO', anunciar),
        ],
        dictado: (texto) => {
            if (!/\b(ya )?(me )?tom(e|é)\b/i.test(texto)) return null;
            const toma = tomaPorNombre(texto);
            if (!toma) return null;
            return [{ tipo: 'accion', indice: -1, accion: { frases: [], ejecutar: () => void marcarTomada(toma) } }];
        },
    });

    const hoy = new Date();
    const fechaHoy = diaLargo(hoy);

    return (
        <FondoPantalla>
            <Encabezado
                volver
                alVolver={() => router.replace('/paciente/salud')}
                icono="hoy"
                titulo="Hoy"
                subtitulo={fechaHoy.charAt(0).toUpperCase() + fechaHoy.slice(1)}
            />

            {aviso && (
                <View style={styles.aviso}>
                    <Aviso tipo={aviso.tipo} mensaje={aviso.mensaje} />
                </View>
            )}

            <EstadoCarga cargando={cargando && tomas.length === 0 && actividades.length === 0} error={error} reintentar={cargar} hayDatos />

            <Tarjeta
                titulo="Medicamentos de hoy"
                icono="medicamento"
                extra={
                    tomas.length > 0 ? (
                        <Texto variante="etiqueta" color="primario" peso="700" accessibilityLabel={`${tomadas} de ${tomas.length} tomas registradas`}>
                            {tomadas} de {tomas.length}
                        </Texto>
                    ) : null
                }
            >
                {tomas.length > 0 && (
                    <View style={[styles.progreso, { backgroundColor: colores.superficieSuave }]} accessibilityElementsHidden importantForAccessibility="no">
                        <View style={[styles.relleno, { width: `${(tomadas / tomas.length) * 100}%`, backgroundColor: colores.exito }]} />
                    </View>
                )}
                {!cargando && tomasVigentes.length === 0 && (
                    <Texto variante="cuerpo" color="textoSecundario">
                        {tomas.length === 0 ? 'Hoy no tienes medicamentos programados.' : 'Por hoy no tienes más medicamentos programados.'}
                    </Texto>
                )}
                <View style={styles.lista}>
                    {tomasVigentes.map((t) => (
                        <ElementoToma key={t.id} toma={t} marcando={marcando === t.id} alMarcar={() => void marcarTomada(t)} />
                    ))}
                </View>
            </Tarjeta>

            <Tarjeta titulo="Actividades de hoy" icono="calendario">
                {!cargando && actividadesVigentes.length === 0 && (
                    <Texto variante="cuerpo" color="textoSecundario">
                        {actividades.length === 0 ? 'Hoy no tienes citas ni actividades.' : 'Por hoy no tienes más citas ni actividades.'}
                    </Texto>
                )}
                <View style={styles.lista}>
                    {actividadesVigentes.map((a) => (
                        <ElementoActividad
                            key={a.id}
                            actividad={a}
                            onPress={() => router.push({ pathname: '/paciente/salud/agenda/[id]', params: { id: String(a.id) } })}
                        />
                    ))}
                </View>
            </Tarjeta>

            {cuantasPasaron > 0 && (
                <View style={styles.pasado}>
                    <Pressable
                        onPress={() => setVerPasado((v) => !v)}
                        accessibilityRole="button"
                        accessibilityState={{ expanded: verPasado }}
                        accessibilityLabel={`Ya pasó hoy, ${cuantasPasaron === 1 ? '1 elemento' : `${cuantasPasaron} elementos`}. ${verPasado ? 'Ocultar' : 'Mostrar'}`}
                        style={[styles.botonPasado, { borderColor: colores.borde, backgroundColor: colores.superficie }]}
                    >
                        <Icono nombre="reloj" tamano={20} color={colores.textoSecundario} />
                        <Texto variante="etiqueta" color="textoSecundario" peso="700" style={styles.textoPasado}>
                            Ya pasó hoy ({cuantasPasaron})
                        </Texto>
                        <Texto variante="etiqueta" color="primario" peso="700">
                            {verPasado ? 'Ocultar' : 'Mostrar'}
                        </Texto>
                    </Pressable>
                    {verPasado && (
                        <View style={styles.lista}>
                            {/* Si se tomó pero no se registró a tiempo, todavía se puede marcar */}
                            {tomasPasadas.map((t) => (
                                <ElementoToma key={`t${t.id}`} toma={t} marcando={marcando === t.id} alMarcar={() => void marcarTomada(t)} />
                            ))}
                            {actividadesPasadas.map((a) => (
                                <ElementoActividad
                                    key={`a${a.id}`}
                                    actividad={a}
                                    onPress={() => router.push({ pathname: '/paciente/salud/agenda/[id]', params: { id: String(a.id) } })}
                                />
                            ))}
                        </View>
                    )}
                </View>
            )}
        </FondoPantalla>
    );
}

const styles = StyleSheet.create({
    aviso: {
        marginBottom: Espacio.l,
    },
    lista: {
        gap: Espacio.s,
    },
    progreso: {
        height: 10,
        borderRadius: 5,
        overflow: 'hidden',
    },
    relleno: {
        height: '100%',
        borderRadius: 5,
    },
    pasado: {
        gap: Espacio.m,
        marginTop: Espacio.s,
    },
    botonPasado: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Espacio.s,
        borderWidth: 1.5,
        borderRadius: 16,
        paddingHorizontal: Espacio.l,
        minHeight: 52,
    },
    textoPasado: {
        flex: 1,
    },
});
