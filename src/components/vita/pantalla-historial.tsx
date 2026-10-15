import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Espacio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';
import { useComandosPantalla } from '@/context/asistente-context';
import type { NivelIntensidad } from '@/dto/NivelIntensidad';
import type { OrdenSintoma } from '@/dto/OrdenSintoma';
import type { SintomaResponse } from '@/dto/SintomaResponse';
import type { AccionVoz, Resultado } from '@/utils/comandos-voz';
import { aPalabras } from '@/utils/comandos-voz';
import { deFechaLocal, diasAtras, fechaHoraCorta } from '@/utils/fechas';
import { tomarAvisoPendiente, type FuenteSintomas } from '@/utils/fuente-sintomas';
import { mensajeDeError } from '@/utils/sesion';
import { ORDENES, PERIODOS, type Periodo } from '@/utils/sintomas';

import { accionesComunesVoz } from './acciones-cuenta';
import { Aviso } from './aviso';
import { Boton } from './boton';
import { ControlSegmentado } from './control-segmentado';
import { ElementoSintoma } from './elemento-sintoma';
import { Encabezado } from './encabezado';
import { EstadoCarga } from './estado-carga';
import { FondoPantalla } from './fondo-pantalla';
import { OpcionesFiltro } from './opciones-filtro';
import { Tarjeta } from './tarjeta';
import { Texto } from './texto';

const TAMANO_PAGINA = 20;

/** Filtro por nivel: se traduce al rango de intensidad que entiende el backend. */
type FiltroNivel = 'TODAS' | NivelIntensidad;
const NIVELES: { valor: FiltroNivel; titulo: string; min?: number; max?: number }[] = [
    { valor: 'TODAS', titulo: 'Todas' },
    { valor: 'LEVE', titulo: 'Leve', min: 1, max: 3 },
    { valor: 'MODERADA', titulo: 'Moderada', min: 4, max: 6 },
    { valor: 'SEVERA', titulo: 'Severa', min: 7, max: 10 },
];

/** "Hoy", "Ayer" o "lunes 12 de octubre" (para agrupar la lista por día). */
function nombreDia(fechaHora: string): string {
    const fecha = deFechaLocal(fechaHora);
    const hoy = new Date();
    const ayer = new Date();
    ayer.setDate(hoy.getDate() - 1);
    const igual = (a: Date, b: Date) => a.toDateString() === b.toDateString();
    if (igual(fecha, hoy)) return 'Hoy';
    if (igual(fecha, ayer)) return 'Ayer';
    const texto = fecha.toLocaleDateString('es-CO', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: fecha.getFullYear() === hoy.getFullYear() ? undefined : 'numeric',
    });
    return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Cómo se describe en voz alta el filtro elegido ("de los últimos 7 días, de mareo, severos"). */
function describirFiltro(periodo: Periodo, tipo: string | null, nivel: FiltroNivel, orden: OrdenSintoma): string {
    const partes = [
        periodo === 'hoy' ? 'de hoy' : periodo === 'semana' ? 'de los últimos 7 días' : periodo === 'mes' ? 'de los últimos 30 días' : '',
        tipo ? `de ${tipo.toLowerCase()}` : '',
        nivel === 'LEVE' ? 'leves' : nivel === 'MODERADA' ? 'moderados' : nivel === 'SEVERA' ? 'severos' : '',
        orden === 'INTENSIDAD' ? 'del más intenso al menos intenso' : orden === 'ANTIGUOS' ? 'del más antiguo al más reciente' : '',
    ];
    return partes.filter(Boolean).join(', ');
}

const esPeriodo = (v?: string): v is Periodo => !!v && PERIODOS.some((p) => p.valor === v);
const esOrden = (v?: string): v is OrdenSintoma => !!v && ORDENES.some((o) => o.valor === v);
const esNivel = (v?: string): v is FiltroNivel => !!v && NIVELES.some((n) => n.valor === v);

type Props = {
    fuente: FuenteSintomas;
    /** Nombre del paciente en los títulos y en la voz ("Historial de Ana"). Solo para el personal de salud. */
    nombrePaciente?: string;
};

/**
 * Historial completo de síntomas, en su propia página (como Evolución): filtros arriba (síntoma,
 * periodo, intensidad y orden), cuántos hay, y la lista agrupada por día. Al tocar uno se abre su detalle.
 * Puede llegar con filtros ya puestos desde "Mis síntomas" (por ejemplo, al decir "solo esta semana").
 */
export function PantallaHistorial({ fuente, nombrePaciente }: Props) {
    const { anunciar, colores } = useAccesibilidad();
    const inicial = useLocalSearchParams<{ periodo?: string; tipo?: string; orden?: string; nivel?: string }>();

    const [tipos, setTipos] = useState<string[]>([]);
    const [sintomas, setSintomas] = useState<SintomaResponse[]>([]);
    const [total, setTotal] = useState(0);
    const [pagina, setPagina] = useState(0);
    const [ultima, setUltima] = useState(true);

    const [periodo, setPeriodo] = useState<Periodo>(esPeriodo(inicial.periodo) ? inicial.periodo : 'todo');
    const [orden, setOrden] = useState<OrdenSintoma>(esOrden(inicial.orden) ? inicial.orden : 'RECIENTES');
    const [nivel, setNivel] = useState<FiltroNivel>(esNivel(inicial.nivel) ? inicial.nivel : 'TODAS');
    const [tipo, setTipo] = useState<string | null>(inicial.tipo || null);

    const [cargando, setCargando] = useState(true);
    const [cargandoMas, setCargandoMas] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [aviso, setAviso] = useState<{ tipo: 'exito' | 'error'; mensaje: string } | null>(null);

    /** Si se filtró por voz (o se llegó con un filtro pedido por voz), al cargar se dice cuántos quedaron. */
    const anunciarResultadoRef = useRef(!!(inicial.periodo || inicial.tipo || inicial.orden || inicial.nivel));

    const volver = () => (router.canGoBack() ? router.back() : router.replace(fuente.rutas.lista));

    useEffect(() => {
        fuente
            .tipos()
            .then(setTipos)
            .catch(() => setTipos([]));
    }, [fuente]);

    const cargarPagina = async (siguiente: boolean) => {
        const dias = PERIODOS.find((p) => p.valor === periodo)?.dias ?? null;
        const rango = NIVELES.find((n) => n.valor === nivel);
        const datos = await fuente.listar({
            desde: dias === null ? undefined : diasAtras(dias),
            tipo: tipo ?? undefined,
            intensidadMin: rango?.min,
            intensidadMax: rango?.max,
            orden,
            pagina: siguiente ? pagina + 1 : 0,
            tamano: TAMANO_PAGINA,
        });
        setSintomas((antes) => (siguiente ? [...antes, ...datos.contenido] : datos.contenido));
        setPagina(datos.pagina);
        setUltima(datos.ultima);
        setTotal(datos.totalElementos);
        return datos;
    };

    const cargar = async () => {
        setCargando(true);
        setError(null);
        try {
            const datos = await cargarPagina(false);
            if (anunciarResultadoRef.current) {
                anunciarResultadoRef.current = false;
                const filtro = describirFiltro(periodo, tipo, nivel, orden);
                anunciar(
                    datos.totalElementos === 0
                        ? `No hay síntomas ${filtro || 'registrados'}.`
                        : `${datos.totalElementos === 1 ? 'Hay 1 síntoma' : `Hay ${datos.totalElementos} síntomas`}${filtro ? ` ${filtro}` : ''}. Para escucharlos, di: lee la lista.`,
                );
            }
        } catch (e) {
            setError(mensajeDeError(e, 'No pudimos cargar el historial.'));
        } finally {
            setCargando(false);
        }
    };

    // Al cambiar un filtro se recarga
    useEffect(() => {
        void cargar();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [periodo, orden, nivel, tipo]);

    // Al volver del detalle (por ejemplo, después de eliminar uno) se recarga y se muestra el aviso
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

    const verMas = async () => {
        if (cargandoMas) return;
        if (ultima) {
            anunciar('Ya están todos los síntomas en la lista.');
            return;
        }
        setCargandoMas(true);
        try {
            const datos = await cargarPagina(true);
            anunciar(`Se cargaron ${datos.contenido.length} síntomas más.`);
        } catch (e) {
            anunciar(mensajeDeError(e, 'No pudimos cargar más síntomas.'));
        } finally {
            setCargandoMas(false);
        }
    };

    const eliminar = async (sintoma: SintomaResponse) => {
        if (!fuente.eliminar) return;
        try {
            await fuente.eliminar(sintoma.id);
            const mensaje = `Se eliminó el síntoma ${sintoma.tipo.toLowerCase()}, ${fechaHoraCorta(sintoma.fechaHora).toLowerCase()}`.replace(/\.?$/, '.');
            setAviso({ tipo: 'exito', mensaje });
            anunciar(mensaje);
            await cargar();
        } catch (e) {
            const mensaje = mensajeDeError(e, 'No pudimos eliminar el síntoma.');
            setAviso({ tipo: 'error', mensaje });
            anunciar(mensaje);
        }
    };

    /** Cambia un filtro; si fue por voz, al cargar se dice el resultado. */
    const filtrarPorVoz = (cambio: () => void) => {
        anunciarResultadoRef.current = true;
        cambio();
    };

    const filtro = describirFiltro(periodo, tipo, nivel, orden);
    const hayFiltros = periodo !== 'todo' || !!tipo || nivel !== 'TODAS' || orden !== 'RECIENTES';
    const quitarFiltros = () => {
        setPeriodo('todo');
        setTipo(null);
        setNivel('TODAS');
        setOrden('RECIENTES');
    };

    const accionesFiltro: AccionVoz[] = [
        { frases: ['solo hoy', 'los de hoy', 'sintomas de hoy', 'de hoy'], ejecutar: () => filtrarPorVoz(() => setPeriodo('hoy')) },
        {
            frases: ['esta semana', 'ultima semana', 'ultimos 7 dias', 'ultimos siete dias', 'de la semana'],
            ejecutar: () => filtrarPorVoz(() => setPeriodo('semana')),
        },
        {
            frases: ['este mes', 'ultimo mes', 'ultimos 30 dias', 'ultimos treinta dias', 'del mes'],
            ejecutar: () => filtrarPorVoz(() => setPeriodo('mes')),
        },
        {
            frases: ['ver todo', 'todo el historial', 'quita los filtros', 'quitar los filtros', 'quita el filtro', 'sin filtros', 'todos los sintomas'],
            ejecutar: () => filtrarPorVoz(quitarFiltros),
        },
        { frases: ['solo leves', 'los leves', 'leves'], ejecutar: () => filtrarPorVoz(() => setNivel('LEVE')) },
        { frases: ['solo moderados', 'los moderados', 'moderados', 'moderadas'], ejecutar: () => filtrarPorVoz(() => setNivel('MODERADA')) },
        { frases: ['solo severos', 'los severos', 'severos', 'severas', 'los graves'], ejecutar: () => filtrarPorVoz(() => setNivel('SEVERA')) },
        { frases: ['todas las intensidades', 'cualquier intensidad'], ejecutar: () => filtrarPorVoz(() => setNivel('TODAS')) },
        {
            frases: ['mas intensos', 'mas fuertes', 'por intensidad', 'ordena por intensidad'],
            ejecutar: () => filtrarPorVoz(() => setOrden('INTENSIDAD')),
        },
        { frases: ['mas recientes', 'recientes primero'], ejecutar: () => filtrarPorVoz(() => setOrden('RECIENTES')) },
        { frases: ['mas antiguos', 'antiguos primero'], ejecutar: () => filtrarPorVoz(() => setOrden('ANTIGUOS')) },
    ];

    /** "Solo mareo", "muestra dolor de cabeza": filtra por un tipo de síntoma. */
    const dictado = (texto: string): Resultado[] | null => {
        const pedido = /^(?:solo|solamente|muestrame solo|filtra(?: por)?|ver solo)\s+(?:los? |las? |de )*(.+)$/.exec(aPalabras(texto));
        if (!pedido) return null;
        // "solo esta semana", "solo los más intensos": son filtros de periodo, nivel u orden, no un síntoma
        if (accionesFiltro.some((a) => a.frases.some((f) => pedido[1].includes(f) || f.endsWith(pedido[1])))) return null;
        const buscado = pedido[1];
        const encontrado = tipos.find((t) => aPalabras(t) === buscado) ?? tipos.find((t) => aPalabras(t).includes(buscado) || buscado.includes(aPalabras(t)));
        return [
            {
                tipo: 'accion',
                indice: -1,
                accion: {
                    frases: [],
                    ejecutar: () =>
                        encontrado
                            ? filtrarPorVoz(() => setTipo(encontrado))
                            : anunciar(`No encontré síntomas de ${buscado}. Para escuchar todos, di: lee la lista.`),
                },
            },
        ];
    };

    const deQuien = nombrePaciente ? ` de ${nombrePaciente}` : '';
    const titulo = nombrePaciente ? `Historial de ${nombrePaciente.split(' ')[0]}` : 'Historial';

    useComandosPantalla({
        titulo,
        descripcion:
            `${titulo}. Puedes decir: lee la lista, abre el número 1, solo esta semana, solo severos, los más intensos` +
            (tipos[0] ? `, solo ${tipos[0].toLowerCase()}` : '') +
            ' o quita los filtros.',
        ejemplos: ['lee la lista', 'abre el número 1', 'solo esta semana', 'solo severos', 'los más intensos', 'quita los filtros', 'ver más'],
        campos: [],
        listas: [
            {
                claves: ['mis sintomas', 'lee la lista', 'lee los sintomas', 'historial', 'lista', 'sintomas', 'que he registrado'],
                nombre: `Síntomas${deQuien}${filtro ? `, ${filtro}` : ''}`,
                vacia: `No hay síntomas${filtro ? ` ${filtro}` : ' registrados todavía'}.`,
                elementos: sintomas.map((s) => ({
                    nombre: s.tipo,
                    detalle: `intensidad ${s.intensidad} de 10, ${fechaHoraCorta(s.fechaHora).toLowerCase()}`,
                })),
                acciones: [
                    {
                        frases: ['abre', 'abrir', 'ver', 'muestra', 'mostrar', 'muestrame', 'detalle de', 'detalle del'],
                        ejecutar: (i) => router.push(fuente.rutas.detalle(sintomas[i].id)),
                    },
                    ...(fuente.editable && fuente.rutas.editar
                        ? [
                            {
                                frases: ['edita', 'editar', 'cambia', 'cambiar', 'modifica', 'modificar', 'corrige', 'corregir'],
                                ejecutar: (i: number) => router.push(fuente.rutas.editar!(sintomas[i].id)),
                            },
                            {
                                frases: ['elimina', 'eliminar', 'borra', 'borrar', 'quita', 'quitar'],
                                confirmar: (e: { nombre: string; detalle?: string }) => `¿Seguro que quieres eliminar el síntoma ${e.nombre.toLowerCase()}, ${e.detalle}?`,
                                ejecutar: (i: number) => void eliminar(sintomas[i]),
                            },
                        ]
                        : []),
                ],
            },
        ],
        acciones: [
            ...accionesFiltro,
            { frases: ['ver mas', 'cargar mas', 'mas sintomas', 'siguientes'], ejecutar: () => void verMas() },
            // El profesional solo consulta: si pide modificar, se le explica
            ...(!fuente.editable
                ? [
                    {
                        frases: ['eliminar', 'elimina', 'borrar', 'borra', 'editar', 'edita', 'cambiar', 'cambia', 'modificar', 'registrar', 'registra'],
                        ejecutar: () => anunciar('Solo puedes consultar los síntomas del paciente. Solo el paciente puede registrarlos, editarlos o eliminarlos.'),
                    },
                ]
                : []),
            { frases: ['volver', 'atras', 'regresar'], ejecutar: volver },
            ...accionesComunesVoz(fuente.rol, anunciar),
        ],
        dictado,
    });

    // La lista agrupada por día (solo cuando está ordenada por fecha; por intensidad va seguida)
    const porFecha = orden !== 'INTENSIDAD';
    const grupos: { dia: string; items: { sintoma: SintomaResponse; numero: number }[] }[] = [];
    sintomas.forEach((s, i) => {
        const dia = porFecha ? nombreDia(s.fechaHora) : '';
        const ultimo = grupos[grupos.length - 1];
        if (ultimo && ultimo.dia === dia) ultimo.items.push({ sintoma: s, numero: i + 1 });
        else grupos.push({ dia, items: [{ sintoma: s, numero: i + 1 }] });
    });

    return (
        <FondoPantalla>
            <Encabezado volver alVolver={volver} titulo={titulo} subtitulo="Todos los síntomas registrados, con filtros." />

            {aviso && (
                <View style={styles.aviso}>
                    <Aviso tipo={aviso.tipo} mensaje={aviso.mensaje} />
                </View>
            )}

            {/* Filtros arriba: cambian la lista de abajo */}
            <Tarjeta>
                <View style={styles.filtros}>
                    {tipos.length > 0 && (
                        <>
                            <Texto variante="etiqueta">Síntoma</Texto>
                            <OpcionesFiltro
                                etiqueta="Síntoma"
                                opciones={[{ valor: '', titulo: 'Todos' }, ...tipos.map((t) => ({ valor: t, titulo: t }))]}
                                valor={tipo ?? ''}
                                onCambiar={(valor) => setTipo(valor || null)}
                            />
                        </>
                    )}
                    <Texto variante="etiqueta" style={styles.separado}>
                        Periodo
                    </Texto>
                    <ControlSegmentado etiqueta="Periodo" opciones={PERIODOS} valor={periodo} onCambiar={setPeriodo} />
                    <Texto variante="etiqueta" style={styles.separado}>
                        Intensidad
                    </Texto>
                    <ControlSegmentado etiqueta="Intensidad" opciones={NIVELES} valor={nivel} onCambiar={setNivel} />
                    <Texto variante="etiqueta" style={styles.separado}>
                        Orden
                    </Texto>
                    <ControlSegmentado etiqueta="Orden" opciones={ORDENES} valor={orden} onCambiar={setOrden} />
                </View>
            </Tarjeta>

            {/* Cuántos hay con estos filtros */}
            <View style={styles.conteo} accessible accessibilityLiveRegion="polite">
                <Texto variante="subtitulo" peso="800">
                    {cargando ? 'Buscando…' : total === 1 ? '1 síntoma' : `${total} síntomas`}
                </Texto>
                {hayFiltros && (
                    <Boton titulo="Quitar filtros" variante="secundario" onPress={quitarFiltros} />
                )}
            </View>

            <EstadoCarga
                cargando={cargando && sintomas.length === 0}
                error={error}
                reintentar={cargar}
                hayDatos={sintomas.length > 0}
                vacio={
                    hayFiltros
                        ? 'No hay síntomas con estos filtros.'
                        : fuente.editable
                            ? 'Aún no tienes síntomas registrados.'
                            : 'Este paciente todavía no ha registrado síntomas.'
                }
            />

            {grupos.map((g, k) => (
                <View key={`${g.dia}-${k}`} style={styles.grupo}>
                    {porFecha && (
                        <Texto variante="etiqueta" peso="800" color="textoSecundario" accessibilityRole="header" style={styles.dia}>
                            {g.dia}
                        </Texto>
                    )}
                    {g.items.map(({ sintoma, numero }) => (
                        <ElementoSintoma
                            key={sintoma.id}
                            sintoma={sintoma}
                            numero={numero}
                            onPress={() => router.push(fuente.rutas.detalle(sintoma.id))}
                        />
                    ))}
                </View>
            ))}

            {!ultima && (
                <View style={[styles.mas, { borderColor: colores.borde }]}>
                    <Boton titulo="Ver más síntomas" variante="secundario" cargando={cargandoMas} onPress={verMas} />
                </View>
            )}
        </FondoPantalla>
    );
}

const styles = StyleSheet.create({
    aviso: {
        marginBottom: Espacio.l,
    },
    filtros: {
        gap: Espacio.s,
    },
    separado: {
        marginTop: Espacio.s,
    },
    conteo: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: Espacio.m,
        marginBottom: Espacio.m,
        flexWrap: 'wrap',
    },
    grupo: {
        gap: Espacio.s,
        marginBottom: Espacio.l,
    },
    dia: {
        marginTop: Espacio.xs,
    },
    mas: {
        marginBottom: Espacio.xl,
    },
});