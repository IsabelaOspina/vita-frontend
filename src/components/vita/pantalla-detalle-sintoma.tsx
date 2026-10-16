import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Espacio, Radio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';
import { useComandosPantalla } from '@/context/asistente-context';
import type { HorarioMedicamentoResponse } from '@/dto/HorarioMedicamentoResponse';
import type { MedicamentoResponse } from '@/dto/MedicamentoResponse';
import type { TomaMedicamentoResponse } from '@/dto/TomaMedicamentoResponse';
import { cancelarHorario, listarHorarios } from '@/services/horarioMedicamenteService';
import { desactivarMedicamento, obtenerMedicamento } from '@/services/medicamentoService';
import { marcarTomaTomada } from '@/services/TomaMedicamentoService';
import { deFechaLocal, horaCorta } from '@/utils/fechas';
import { dejarAvisoPendiente, tomarAvisoPendiente } from '@/utils/fuente-sintomas';
import { mensajeDeError } from '@/utils/sesion';
import { describirHorario, horarioVigente, nombreDiaRelativo, sinPuntoDoble, nombreTipoAviso, rangoDeLaSemana, rangoDelDia, tomaPorMarcar, vigenciaHorario } from '@/utils/salud';
import { tomasDeMedicamento } from '@/utils/tomas';

import { accionesComunesVoz } from './acciones-cuenta';
import { Aviso } from './aviso';
import { Boton } from './boton';
import { ElementoToma } from './elemento-toma';
import { Encabezado } from './encabezado';
import { EstadoCarga } from './estado-carga';
import { FilaDato } from './fila-dato';
import { FondoPantalla } from './fondo-pantalla';
import { Icono } from './icono';
import { Tarjeta } from './tarjeta';
import { Texto } from './texto';

/**
 * Un medicamento: sus datos, sus horarios (agregar y quitar) y las tomas de esta semana, con
 * "Ya lo tomé" en las pendientes hasta hoy. Desde aquí se edita o se desactiva.
 */
export function PantallaDetalleMedicamento({ id }: { id: number }) {
    const { anunciar, leer, colores } = useAccesibilidad();

    const [medicamento, setMedicamento] = useState<MedicamentoResponse | null>(null);
    const [horarios, setHorarios] = useState<HorarioMedicamentoResponse[]>([]);
    const [tomas, setTomas] = useState<TomaMedicamentoResponse[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [aviso, setAviso] = useState<{ tipo: 'exito' | 'error'; mensaje: string } | null>(null);
    const [marcando, setMarcando] = useState<number | null>(null);
    const [confirmando, setConfirmando] = useState<'desactivar' | number | null>(null);
    const [trabajando, setTrabajando] = useState(false);

    const cargar = useCallback(async () => {
        setCargando(true);
        setError(null);
        try {
            const [m, h] = await Promise.all([obtenerMedicamento(id), listarHorarios(id)]);
            const { desde, hasta } = rangoDeLaSemana(new Date());
            setMedicamento(m);
            setHorarios(h);
            setTomas(m.activo ? await tomasDeMedicamento(id, h, desde, hasta) : []);
            return m;
        } catch (e) {
            setError(mensajeDeError(e, 'No pudimos cargar el medicamento.'));
            return null;
        } finally {
            setCargando(false);
        }
    }, [id]);

    const lectura = (m: MedicamentoResponse, lista: HorarioMedicamentoResponse[]) => {
        const activos = lista.filter((h) => horarioVigente(h));
        return (
            `${m.nombre}${m.dosis ? `, ${m.dosis}` : ''}${m.viaAdministracion ? `, vía ${m.viaAdministracion.toLowerCase()}` : ''}. ` +
            (m.activo ? '' : 'Está desactivado. ') +
            (activos.length ? `Horarios: ${activos.map(describirHorario).join('. ')}.` : 'Todavía no tiene horarios.')
        );
    };

    const primeraVezRef = useRef(true);
    useFocusEffect(
        useCallback(() => {
            const pendiente = tomarAvisoPendiente();
            if (pendiente) setAviso({ tipo: 'exito', mensaje: pendiente });
            void cargar().then((m) => {
                if (m && primeraVezRef.current && !pendiente) leer(lectura(m, horarios), true);
                primeraVezRef.current = false;
            });
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [cargar]),
    );

    const volver = () => (router.canGoBack() ? router.back() : router.replace('/paciente/salud/medicamentos'));
    const avisar = (tipo: 'exito' | 'error', texto: string) => {
        const mensaje = sinPuntoDoble(texto);
        setAviso({ tipo, mensaje });
        anunciar(mensaje);
    };

    // Los horarios con fecha de fin vencida ya no se muestran como vigentes
    const activos = horarios.filter((h) => horarioVigente(h));
    const terminados = horarios.filter((h) => h.activo && !horarioVigente(h)).length;
    const finDeHoy = rangoDelDia(new Date()).hasta;
    // "Ya lo tomé" solo para tomas hasta hoy; las de días siguientes se ven pero no se marcan
    const marcables = tomas.filter((t) => tomaPorMarcar(t) && t.fechaHora <= finDeHoy);
    const tomadas = tomas.filter((t) => !tomaPorMarcar(t) && t.estado === 'TOMADO').length;
    const hastaHoy = tomas.filter((t) => t.fechaHora <= finDeHoy);

    const marcar = async (toma: TomaMedicamentoResponse) => {
        setMarcando(toma.id);
        try {
            const actualizada = await marcarTomaTomada(toma.id);
            setTomas((lista) => lista.map((t) => (t.id === toma.id ? actualizada : t)));
            avisar('exito', `Listo, registré la toma de ${nombreDiaRelativo(deFechaLocal(toma.fechaHora)).toLowerCase()} a las ${horaCorta(deFechaLocal(toma.fechaHora))}.`);
        } catch (e) {
            avisar('error', mensajeDeError(e, 'No pudimos registrar la toma.'));
        } finally {
            setMarcando(null);
        }
    };

    const quitarHorario = async (h: HorarioMedicamentoResponse) => {
        setTrabajando(true);
        try {
            await cancelarHorario(id, h.id);
            avisar('exito', `Listo, quité el horario: ${describirHorario(h).toLowerCase()}.`);
            await cargar();
        } catch (e) {
            avisar('error', mensajeDeError(e, 'No pudimos quitar el horario.'));
        } finally {
            setTrabajando(false);
            setConfirmando(null);
        }
    };

    const desactivar = async () => {
        if (!medicamento) return;
        setTrabajando(true);
        try {
            await desactivarMedicamento(id);
            const mensaje = `Se desactivó ${medicamento.nombre}. Ya no recibirás avisos de este medicamento.`;
            anunciar(mensaje);
            dejarAvisoPendiente(mensaje);
            router.dismissTo('/paciente/salud/medicamentos');
        } catch (e) {
            avisar('error', mensajeDeError(e, 'No pudimos desactivar el medicamento.'));
        } finally {
            setTrabajando(false);
            setConfirmando(null);
        }
    };

    const nuevoHorario = () => router.push({ pathname: '/paciente/salud/medicamentos/horario', params: { medicamento: String(id) } });
    const editar = () => router.push({ pathname: '/paciente/salud/medicamentos/editar/[id]', params: { id: String(id) } });
    const cuandoToma = (t: TomaMedicamentoResponse) => `${nombreDiaRelativo(deFechaLocal(t.fechaHora)).toLowerCase()} a las ${horaCorta(deFechaLocal(t.fechaHora))}`;
    const activo = medicamento?.activo ?? false;

    useComandosPantalla({
        cargando: cargando,
        titulo: medicamento?.nombre ?? 'Medicamento',
        descripcion: activo
            ? `${medicamento?.nombre}. Puedes decir: lee el medicamento, ya me lo tomé, lee las tomas, agregar horario, editar o desactivar.`
            : 'Medicamento desactivado. Puedes decir: lee el medicamento o volver.',
        ejemplos: ['lee el medicamento', 'ya me lo tomé', 'lee las tomas', 'agregar horario', 'lee los horarios', 'editar', 'desactivar'],
        campos: [],
        listas: [
            {
                claves: ['lee los horarios', 'horarios', 'mis horarios'],
                nombre: 'Horarios',
                vacia: 'Este medicamento todavía no tiene horarios. Di: agregar horario.',
                elementos: activos.map((h) => ({ nombre: describirHorario(h), detalle: `aviso de ${nombreTipoAviso(h.tipoRecordatorio).toLowerCase()}` })),
                acciones: [
                    {
                        frases: ['quita', 'quitar', 'cancela', 'cancelar', 'elimina', 'borra'],
                        confirmar: (e) => `¿Quito el horario ${e.nombre.toLowerCase()}? Ya no recibirás esos avisos.`,
                        ejecutar: (i) => void quitarHorario(activos[i]),
                    },
                ],
            },
            {
                claves: ['lee las tomas', 'tomas', 'tomas de la semana', 'como voy'],
                nombre: 'Tomas de esta semana hasta hoy',
                vacia: 'Esta semana no hay tomas hasta hoy.',
                elementos: hastaHoy.map((t) => ({ nombre: cuandoToma(t), detalle: tomaPorMarcar(t) ? 'pendiente' : t.estado === 'TOMADO' ? 'tomado' : 'no se registró' })),
                acciones: [
                    {
                        frases: ['ya me tome', 'marca como tomado', 'tomado', 'ya lo tome'],
                        noAplica: (i) => (tomaPorMarcar(hastaHoy[i]) ? null : 'Esa toma ya no está pendiente.'),
                        ejecutar: (i) => void marcar(hastaHoy[i]),
                    },
                ],
            },
        ],
        acciones: [
            { frases: ['lee el medicamento', 'leer', 'lee', 'detalle', 'que dice'], etiqueta: 'leer el medicamento', ejecutar: () => anunciar(medicamento ? lectura(medicamento, horarios) : 'Todavía estoy cargando el medicamento.') },
            ...(activo
                ? [
                      {
                          frases: ['ya me lo tome', 'ya me la tome', 'ya lo tome', 'me lo tome', 'marcar como tomado'],
                          etiqueta: 'registrar la toma pendiente',
                          ejecutar: () => {
                              const toma = marcables[marcables.length - 1];
                              if (toma) void marcar(toma);
                              else anunciar('No tienes tomas pendientes de este medicamento hasta hoy.');
                          },
                      },
                      { frases: ['agregar horario', 'nuevo horario', 'agrega un horario', 'programar', 'programa'], etiqueta: 'agregar un horario', ejecutar: nuevoHorario },
                      { frases: ['editar', 'edita', 'cambiar', 'modificar'], etiqueta: 'editar el medicamento', ejecutar: editar },
                      {
                          frases: ['desactivar', 'desactiva', 'ya no lo tomo', 'eliminar', 'elimina', 'borrar'],
                          etiqueta: 'desactivar el medicamento',
                          confirmar: '¿Seguro que quieres desactivar este medicamento? Ya no recibirás sus avisos.',
                          ejecutar: () => void desactivar(),
                      },
                  ]
                : []),
            { frases: ['volver', 'atras', 'regresar', 'mis medicamentos'], ejecutar: volver },
            ...accionesComunesVoz('USUARIO', anunciar),
        ],
    });

    return (
        <FondoPantalla>
            <Encabezado
                volver
                alVolver={volver}
                icono="medicamento"
                titulo={medicamento?.nombre ?? 'Medicamento'}
                subtitulo={medicamento ? [medicamento.dosis, medicamento.viaAdministracion].filter(Boolean).join(' · ') || undefined : undefined}
            />

            {aviso && (
                <View style={styles.aviso}>
                    <Aviso tipo={aviso.tipo} mensaje={aviso.mensaje} />
                </View>
            )}

            <EstadoCarga cargando={cargando && !medicamento} error={error} reintentar={cargar} hayDatos={!!medicamento} />

            {medicamento && (
                <>
                    {!activo && (
                        <View style={styles.aviso}>
                            <Aviso tipo="info" mensaje="Este medicamento está desactivado: no tiene avisos ni tomas." />
                        </View>
                    )}

                    <Tarjeta titulo="Horarios" icono="alarma">
                        {activos.length === 0 && (
                            <Texto variante="cuerpo" color="textoSecundario">
                                {activo
                                    ? terminados
                                        ? 'Sus horarios ya terminaron. Agrega uno nuevo si debes seguir tomándolo.'
                                        : 'Todavía no tiene horarios. Agrega uno para que VITA te recuerde cada toma.'
                                    : 'No tiene horarios activos.'}
                            </Texto>
                        )}
                        {terminados > 0 && activos.length > 0 && (
                            <Texto variante="pequeno" color="textoTenue">
                                {terminados === 1 ? '1 horario ya terminó.' : `${terminados} horarios ya terminaron.`}
                            </Texto>
                        )}
                        {activos.map((h) => (
                            <View key={h.id} style={[styles.horario, { borderColor: colores.borde }]}>
                                <View style={[styles.iconoHorario, { backgroundColor: colores.exitoFondo }]}>
                                    <Icono nombre="alarma" tamano={22} color={colores.exito} />
                                </View>
                                <View style={styles.textos} accessible accessibilityLabel={`${describirHorario(h)}. ${vigenciaHorario(h)}. Aviso de ${nombreTipoAviso(h.tipoRecordatorio).toLowerCase()}.`}>
                                    <Texto variante="cuerpo" peso="700">
                                        {describirHorario(h)}
                                    </Texto>
                                    <Texto variante="pequeno" color="textoSecundario">
                                        {vigenciaHorario(h)} · aviso de {nombreTipoAviso(h.tipoRecordatorio).toLowerCase()}
                                    </Texto>
                                </View>
                                {activo &&
                                    (confirmando === h.id ? (
                                        <View style={styles.acciones}>
                                            <Boton titulo="Sí, quitar" variante="peligro" onPress={() => void quitarHorario(h)} cargando={trabajando} />
                                            <Boton titulo="No" variante="secundario" onPress={() => setConfirmando(null)} />
                                        </View>
                                    ) : (
                                        <View style={styles.acciones}>
                                            <Boton
                                                titulo="Quitar"
                                                variante="secundario"
                                                pista={`Quita el horario ${describirHorario(h).toLowerCase()}`}
                                                onPress={() => {
                                                    setConfirmando(h.id);
                                                    anunciar('¿Quitar este horario? Toca: sí, quitar.');
                                                }}
                                            />
                                        </View>
                                    ))}
                            </View>
                        ))}
                        {activo && <Boton titulo="Agregar horario" icono="agregar" variante="secundario" onPress={nuevoHorario} />}
                    </Tarjeta>

                    {activo && activos.length > 0 && (
                        <Tarjeta
                            titulo="Esta semana"
                            icono="calendario"
                            extra={
                                hastaHoy.length > 0 ? (
                                    <Texto variante="etiqueta" color="primario" peso="700" accessibilityLabel={`${tomadas} de ${hastaHoy.length} tomas registradas hasta hoy`}>
                                        {tomadas} de {hastaHoy.length}
                                    </Texto>
                                ) : null
                            }>
                            {hastaHoy.length > 0 && (
                                <View style={[styles.progreso, { backgroundColor: colores.superficieSuave }]} accessibilityElementsHidden importantForAccessibility="no">
                                    <View style={[styles.relleno, { width: `${(tomadas / hastaHoy.length) * 100}%`, backgroundColor: colores.exito }]} />
                                </View>
                            )}
                            {hastaHoy.length === 0 && (
                                <Texto variante="cuerpo" color="textoSecundario">
                                    Esta semana todavía no hay tomas.
                                </Texto>
                            )}
                            <View style={styles.lista}>
                                {[...hastaHoy].reverse().map((t) => (
                                    <ElementoToma key={t.id} toma={t} conDia conNombre={false} marcando={marcando === t.id} alMarcar={() => void marcar(t)} />
                                ))}
                            </View>
                        </Tarjeta>
                    )}

                    <Tarjeta titulo="Datos" icono="info">
                        <FilaDato etiqueta="Nombre" valor={medicamento.nombre} icono="medicamento" />
                        {medicamento.dosis ? <FilaDato etiqueta="Dosis" valor={medicamento.dosis} icono="info" /> : null}
                        {medicamento.frecuencia ? <FilaDato etiqueta="Frecuencia indicada" valor={medicamento.frecuencia} icono="reloj" /> : null}
                        {medicamento.viaAdministracion ? <FilaDato etiqueta="Vía" valor={medicamento.viaAdministracion} icono="nota" /> : null}
                    </Tarjeta>

                    {activo && (
                        <View style={styles.botones}>
                            <Boton titulo="Editar medicamento" icono="editar" variante="secundario" onPress={editar} />
                            {confirmando === 'desactivar' ? (
                                <View style={[styles.confirmar, { borderColor: colores.error, backgroundColor: colores.errorFondo }]} accessibilityLiveRegion="polite">
                                    <Texto variante="etiqueta">¿Seguro que quieres desactivar este medicamento? Ya no recibirás sus avisos.</Texto>
                                    <Boton titulo="Sí, desactivar" icono="cancelar" variante="peligro" onPress={desactivar} cargando={trabajando} />
                                    <Boton titulo="No, conservarlo" variante="secundario" onPress={() => setConfirmando(null)} />
                                </View>
                            ) : (
                                <Boton
                                    titulo="Desactivar medicamento"
                                    icono="cancelar"
                                    variante="secundario"
                                    onPress={() => {
                                        setConfirmando('desactivar');
                                        anunciar('¿Seguro que quieres desactivar este medicamento? Toca: sí, desactivar.');
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
    horario: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: Espacio.m,
        borderWidth: 1.5,
        borderRadius: Radio.m,
        padding: Espacio.m,
    },
    iconoHorario: {
        width: 40,
        height: 40,
        borderRadius: Radio.s,
        alignItems: 'center',
        justifyContent: 'center',
    },
    textos: {
        flex: 1,
        minWidth: 160,
        gap: 2,
    },
    acciones: {
        flexDirection: 'row',
        gap: Espacio.s,
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
