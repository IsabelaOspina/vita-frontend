import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Espacio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';
import { useComandosPantalla } from '@/context/asistente-context';
import type { ActividadSaludResponse } from '@/dto/ActividadSaludResponse';
import type { TipoActividad } from '@/dto/TipoActividad';
import { listarActividadesPorMes } from '@/services/actividadSaludService';
import { aPalabras, type Resultado } from '@/utils/comandos-voz';
import { aDia, deFechaLocal, horaCorta } from '@/utils/fechas';
import { tomarAvisoPendiente } from '@/utils/fuente-sintomas';
import { mensajeDeError } from '@/utils/sesion';
import { actividadesPorDia, sinPuntoDoble, interpretarFecha, nombreDiaRelativo, nombreTipoActividad, TIPOS_ACTIVIDAD } from '@/utils/salud';

import { accionesComunesVoz } from './acciones-cuenta';
import { Boton } from './boton';
import { CalendarioMes } from './calendario-mes';
import { Aviso } from './aviso';
import { coloresTipoActividad, ElementoActividad } from './elemento-actividad';
import { Encabezado } from './encabezado';
import { EstadoCarga } from './estado-carga';
import { FondoPantalla } from './fondo-pantalla';
import { Tarjeta } from './tarjeta';
import { Texto } from './texto';

/** Frases para crear una actividad por voz: "nueva cita mañana a las 9 en el hospital". */
const NUEVA = /^(?:nueva|nuevo|agenda(?:r)?|agrega(?:r)?|crea(?:r)?|programa(?:r)?|tengo)\s+(?:una?\s+)?(cita(?: medica)?|terapia|actividad|control)\b\s*(.*)$/;

/**
 * Agenda: calendario del mes (con puntos por tipo de actividad) y, debajo, las actividades del
 * día elegido. Las actividades canceladas no se muestran.
 */
export function PantallaAgenda() {
    const { anunciar, colores, altoContraste } = useAccesibilidad();
    const { dia: diaRecibido } = useLocalSearchParams<{ dia?: string }>();
    const [mes, setMes] = useState(() => (diaRecibido ? deFechaLocal(diaRecibido) : new Date()));
    const [dia, setDia] = useState(() => (diaRecibido ? deFechaLocal(diaRecibido) : new Date()));
    const [aviso, setAviso] = useState<{ tipo: 'exito' | 'error'; mensaje: string } | null>(null);
    const [actividades, setActividades] = useState<ActividadSaludResponse[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);
    /** Si el día se eligió por voz, al cargar se lee lo que hay. */
    const leerDiaRef = useRef(false);

    const cargar = useCallback(async () => {
        setCargando(true);
        setError(null);
        try {
            const lista = await listarActividadesPorMes(mes.getFullYear(), mes.getMonth() + 1);
            setActividades(lista.filter((a) => a.estado !== 'CANCELADA'));
        } catch (e) {
            setError(mensajeDeError(e, 'No pudimos cargar la agenda.'));
        } finally {
            setCargando(false);
        }
    }, [mes]);

    useEffect(() => {
        void cargar();
    }, [cargar]);

    // Al volver de crear o editar una actividad
    const primeraVezRef = useRef(true);
    const cargarRef = useRef(cargar);
    cargarRef.current = cargar;
    useFocusEffect(
        useCallback(() => {
            const pendiente = tomarAvisoPendiente();
            if (pendiente) setAviso({ tipo: 'exito', mensaje: pendiente });
            if (primeraVezRef.current) {
                primeraVezRef.current = false;
                return;
            }
            void cargarRef.current();
        }, []),
    );

    // Al volver de guardar una actividad, se abre su día
    useEffect(() => {
        if (!diaRecibido) return;
        const d = deFechaLocal(diaRecibido);
        setDia(d);
        setMes(new Date(d.getFullYear(), d.getMonth(), 1));
        router.setParams({ dia: undefined });
    }, [diaRecibido]);

    const porDia = actividadesPorDia(actividades);
    const marcas: Record<string, TipoActividad[]> = Object.fromEntries(Object.entries(porDia).map(([d, lista]) => [d, lista.map((a) => a.tipo)]));
    const delDia = porDia[aDia(dia)] ?? [];
    const nombreDia = nombreDiaRelativo(dia);

    const lecturaDia = (lista: ActividadSaludResponse[], nombre: string) =>
        lista.length === 0
            ? `${nombre} no tienes actividades.`
            : `${nombre} tienes ${lista.length === 1 ? '1 actividad' : `${lista.length} actividades`}: ` +
              lista.map((a) => `${nombreTipoActividad(a.tipo).toLowerCase()}, ${a.nombre}, a las ${horaCorta(deFechaLocal(a.fechaHora))}`).join('; ');

    // Si el día elegido por voz está en otro mes, primero carga ese mes y luego lee
    useEffect(() => {
        if (!leerDiaRef.current || cargando) return;
        leerDiaRef.current = false;
        anunciar(sinPuntoDoble(`${lecturaDia(delDia, nombreDia)}.`));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cargando, dia]);

    const elegirDia = (fecha: Date, porVoz = false) => {
        setDia(fecha);
        if (fecha.getMonth() !== mes.getMonth() || fecha.getFullYear() !== mes.getFullYear()) setMes(new Date(fecha.getFullYear(), fecha.getMonth(), 1));
        if (porVoz) leerDiaRef.current = true;
    };

    const cambiarMes = (delta: number) => {
        const nuevo = new Date(mes.getFullYear(), mes.getMonth() + delta, 1);
        setMes(nuevo);
        setDia(nuevo);
    };

    const nueva = (params?: Record<string, string>) =>
        router.push({ pathname: '/paciente/salud/agenda/nueva', params: { fecha: aDia(dia), ...params } });

    const dictado = (texto: string): Resultado[] | null => {
        const t = aPalabras(texto);
        const crear = NUEVA.exec(t);
        if (crear) {
            const tipo = /terapia/.test(crear[1]) ? 'TERAPIA' : /cita|control/.test(crear[1]) ? 'CITA_MEDICA' : 'OTRO';
            return [{ tipo: 'accion', indice: -1, accion: { frases: [], ejecutar: () => nueva({ tipo, dictado: crear[2] ?? '' }) } }];
        }
        // "Qué tengo mañana", "qué tengo el viernes", "abre el 20 de octubre"
        const pedido = /^(?:que tengo|que hay|lee|muestra(?:me)?|ver|abre|ve al?)\s+(?:para\s+|el\s+dia\s+)?(.+)$/.exec(t);
        const fecha = pedido ? interpretarFecha(pedido[1]) : interpretarFecha(t);
        if (!fecha) return null;
        return [{ tipo: 'accion', indice: -1, accion: { frases: [], ejecutar: () => elegirDia(fecha, true) } }];
    };

    useComandosPantalla({
        // Al volver de guardar, se espera a tener el día de la actividad antes de leer
        cargando: cargando || !!diaRecibido,
        titulo: 'Agenda',
        descripcion: sinPuntoDoble(`Agenda. ${lecturaDia(delDia, nombreDia)}.`) + ` Puedes decir: qué tengo mañana, nueva cita mañana a las 9, mes siguiente o abre el 1.`,
        ejemplos: ['qué tengo mañana', 'qué tengo el viernes', 'nueva cita mañana a las 9 en el hospital', 'nueva terapia el lunes a las 3', 'mes siguiente', 'abre el 1'],
        campos: [],
        listas: [
            {
                claves: ['lee el dia', 'lee la lista', 'que tengo', 'actividades del dia', 'lista'],
                nombre: `${nombreDia}`,
                vacia: `${nombreDia} no tienes actividades.`,
                elementos: delDia.map((a) => ({
                    nombre: a.nombre,
                    detalle: `${nombreTipoActividad(a.tipo).toLowerCase()}, a las ${horaCorta(deFechaLocal(a.fechaHora))}${a.ubicacion ? `, en ${a.ubicacion}` : ''}`,
                })),
                acciones: [
                    { frases: ['abre', 'abrir', 'ver', 'detalle de', 'muestra'], ejecutar: (i) => router.push({ pathname: '/paciente/salud/agenda/[id]', params: { id: String(delDia[i].id) } }) },
                ],
            },
            {
                claves: ['lee el mes', 'que tengo este mes', 'actividades del mes', 'todo el mes'],
                nombre: 'Este mes',
                vacia: 'Este mes no tienes actividades.',
                elementos: actividades.map((a) => ({
                    nombre: a.nombre,
                    detalle: `${nombreDiaRelativo(deFechaLocal(a.fechaHora)).toLowerCase()} a las ${horaCorta(deFechaLocal(a.fechaHora))}`,
                })),
                acciones: [
                    { frases: ['abre', 'abrir', 'ver', 'detalle de'], ejecutar: (i) => router.push({ pathname: '/paciente/salud/agenda/[id]', params: { id: String(actividades[i].id) } }) },
                ],
            },
        ],
        acciones: [
            { frases: ['nueva actividad', 'nueva cita', 'nueva terapia', 'agregar actividad', 'agendar', 'agregar cita'], etiqueta: 'crear una actividad', ejecutar: () => nueva() },
            { frases: ['mes siguiente', 'proximo mes', 'siguiente mes'], ejecutar: () => cambiarMes(1) },
            { frases: ['mes anterior', 'mes pasado'], ejecutar: () => cambiarMes(-1) },
            { frases: ['hoy', 've a hoy', 'dia de hoy'], ejecutar: () => elegirDia(new Date(), true) },
            { frases: ['volver', 'atras', 'regresar'], ejecutar: () => (router.canGoBack() ? router.back() : router.replace('/paciente/salud')) },
            ...accionesComunesVoz('USUARIO', anunciar),
        ],
        dictado,
    });

    return (
        <FondoPantalla>
            <Encabezado volver alVolver={() => router.replace('/paciente/salud')} icono="calendario" titulo="Agenda" subtitulo="Citas, terapias y actividades de salud" />

            {aviso && (
                <View style={styles.nueva}>
                    <Aviso tipo={aviso.tipo} mensaje={aviso.mensaje} />
                </View>
            )}

            <View style={styles.nueva}>
                <Boton titulo="Nueva actividad" icono="agregar" onPress={() => nueva()} />
            </View>

            <Tarjeta>
                <CalendarioMes mes={mes} marcas={marcas} seleccionado={dia} onElegir={(d) => elegirDia(d)} onCambiarMes={cambiarMes} />
                <View style={styles.leyenda}>
                    {TIPOS_ACTIVIDAD.map((t) => (
                        <View key={t.valor} style={styles.itemLeyenda}>
                            <View style={[styles.punto, { backgroundColor: coloresTipoActividad(t.valor, colores, altoContraste).color }]} />
                            <Texto variante="pequeno" color="textoSecundario">
                                {t.titulo}
                            </Texto>
                        </View>
                    ))}
                </View>
            </Tarjeta>

            <Texto variante="subtitulo" peso="800" accessibilityRole="header" style={styles.tituloDia}>
                {nombreDia === 'Hoy' || nombreDia === 'Mañana' || nombreDia === 'Ayer' ? `${nombreDia}, ${dia.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}` : nombreDia}
            </Texto>

            <EstadoCarga
                cargando={cargando}
                error={error}
                reintentar={cargar}
                hayDatos={delDia.length > 0}
                vacio="No tienes actividades este día. Toca «Nueva actividad» para agregar una."
            />
            <View style={styles.lista}>
                {delDia.map((a) => (
                    <ElementoActividad key={a.id} actividad={a} onPress={() => router.push({ pathname: '/paciente/salud/agenda/[id]', params: { id: String(a.id) } })} />
                ))}
            </View>
        </FondoPantalla>
    );
}

const styles = StyleSheet.create({
    nueva: {
        marginBottom: Espacio.l,
    },
    leyenda: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Espacio.l,
    },
    itemLeyenda: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Espacio.xs,
    },
    punto: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    tituloDia: {
        marginBottom: Espacio.m,
    },
    lista: {
        gap: Espacio.s,
        marginBottom: Espacio.xl,
    },
});
