import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Espacio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';
import { useComandosPantalla } from '@/context/asistente-context';
import type { OrdenSintoma } from '@/dto/OrdenSintoma';
import type { SintomaResponse } from '@/dto/SintomaResponse';
import type { SintomaResumenResponse } from '@/dto/SintomaResumenResponse';
import type { AccionVoz, Resultado } from '@/utils/comandos-voz';
import { aPalabras } from '@/utils/comandos-voz';
import { diasAtras, fechaHoraCorta } from '@/utils/fechas';
import type { FuenteSintomas } from '@/utils/fuente-sintomas';
import { mensajeDeError } from '@/utils/sesion';
import { ORDENES, PERIODOS, separarSintoma, type Periodo } from '@/utils/sintomas';

import { accionesComunesVoz, salir } from './acciones-cuenta';
import { Aviso } from './aviso';
import { Boton } from './boton';
import { ElementoSintoma } from './elemento-sintoma';
import { Encabezado } from './encabezado';
import { EstadoCarga } from './estado-carga';
import { FondoPantalla } from './fondo-pantalla';
import type { NombreIcono } from './icono';
import { OpcionesFiltro } from './opciones-filtro';
import { ResumenSintomas } from './resumen-sintomas';
import { Tarjeta } from './tarjeta';
import { Texto } from './texto';

const TAMANO_PAGINA = 20;
/** Cuántos tipos de síntoma se ofrecen como filtro rápido. */
const TIPOS_EN_FILTRO = 4;

type Props = {
    fuente: FuenteSintomas;
    titulo: string;
    subtitulo: string;
    icono: NombreIcono;
    /** Nombre del paciente en las frases de voz ("Síntomas de Ana"). Solo para el personal de salud. */
    nombrePaciente?: string;
    /** Pantalla interna (la del personal de salud): muestra "Volver". */
    alVolver?: () => void;
};

/** Cómo se describe en voz alta el filtro elegido ("en los últimos 7 días, de mareo"). */
function describirFiltro(periodo: Periodo, tipo: string | null, orden: OrdenSintoma): string {
    const partes = [
        periodo === 'hoy' ? 'de hoy' : periodo === 'semana' ? 'de los últimos 7 días' : periodo === 'mes' ? 'de los últimos 30 días' : '',
        tipo ? `de ${tipo.toLowerCase()}` : '',
        orden === 'INTENSIDAD' ? 'del más intenso al menos intenso' : orden === 'ANTIGUOS' ? 'del más antiguo al más reciente' : '',
    ];
    return partes.filter(Boolean).join(', ');
}

/**
 * Lista de síntomas con su resumen y su historial (con filtros).
 * La usan el paciente (pestaña "Síntomas", puede registrar) y el personal de salud
 * (síntomas de un paciente asignado, solo consulta).
 */
export function PantallaSintomas({ fuente, titulo, subtitulo, icono, nombrePaciente, alVolver }: Props) {
    const { anunciar } = useAccesibilidad();
    const { aviso: avisoRecibido } = useLocalSearchParams<{ aviso?: string }>();

    const [resumen, setResumen] = useState<SintomaResumenResponse | null>(null);
    const [tipos, setTipos] = useState<string[]>([]);
    const [sintomas, setSintomas] = useState<SintomaResponse[]>([]);
    const [total, setTotal] = useState(0);
    const [pagina, setPagina] = useState(0);
    const [ultima, setUltima] = useState(true);

    const [periodo, setPeriodo] = useState<Periodo>('todo');
    const [orden, setOrden] = useState<OrdenSintoma>('RECIENTES');
    const [tipo, setTipo] = useState<string | null>(null);

    const [cargando, setCargando] = useState(true);
    const [cargandoMas, setCargandoMas] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [aviso, setAviso] = useState<{ tipo: 'exito' | 'error'; mensaje: string } | null>(null);

    /** Si se filtró por voz, al terminar de cargar se dice cuántos síntomas quedaron. */
    const anunciarResultadoRef = useRef(false);
    const primeraCargaRef = useRef(true);

    // Al volver de registrar, editar o eliminar llega el mensaje para mostrarlo arriba
    useEffect(() => {
        if (!avisoRecibido) return;
        setAviso({ tipo: 'exito', mensaje: avisoRecibido });
        router.setParams({ aviso: undefined });
    }, [avisoRecibido]);

    const cargarLista = useCallback(
        async (siguiente: boolean) => {
            const dias = PERIODOS.find((p) => p.valor === periodo)?.dias ?? null;
            const numero = siguiente ? pagina + 1 : 0;
            const datos = await fuente.listar({
                desde: dias === null ? undefined : diasAtras(dias),
                tipo: tipo ?? undefined,
                orden,
                pagina: numero,
                tamano: TAMANO_PAGINA,
            });
            setSintomas((antes) => (siguiente ? [...antes, ...datos.contenido] : datos.contenido));
            setPagina(datos.pagina);
            setUltima(datos.ultima);
            setTotal(datos.totalElementos);
            return datos;
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [periodo, orden, tipo, pagina],
    );

    const cargar = useCallback(async () => {
        setCargando(true);
        setError(null);
        try {
            const [datosResumen, datosTipos] = await Promise.all([fuente.resumen(), fuente.tipos(), cargarLista(false)]);
            setResumen(datosResumen);
            setTipos(datosTipos);
        } catch (e) {
            setError(mensajeDeError(e, 'No pudimos cargar los síntomas.'));
        } finally {
            setCargando(false);
        }
    }, [fuente, cargarLista]);

    // Cada vez que se entra a la pantalla (por ejemplo, al volver de registrar uno)
    const cargarRef = useRef(cargar);
    cargarRef.current = cargar;
    useFocusEffect(
        useCallback(() => {
            void cargarRef.current();
        }, []),
    );

    // Al cambiar un filtro se recarga solo el historial
    useEffect(() => {
        if (primeraCargaRef.current) {
            primeraCargaRef.current = false;
            return;
        }
        let vigente = true;
        setCargando(true);
        setError(null);
        cargarLista(false)
            .then((datos) => {
                if (!vigente || !anunciarResultadoRef.current) return;
                anunciarResultadoRef.current = false;
                const filtro = describirFiltro(periodo, tipo, orden);
                anunciar(
                    datos.totalElementos === 0
                        ? `No hay síntomas ${filtro || 'registrados'}.`
                        : `${datos.totalElementos === 1 ? 'Hay 1 síntoma' : `Hay ${datos.totalElementos} síntomas`}${filtro ? ` ${filtro}` : ''}. Para escucharlos, di: lee la lista.`,
                );
            })
            .catch((e) => vigente && setError(mensajeDeError(e, 'No pudimos cargar los síntomas.')))
            .finally(() => vigente && setCargando(false));
        return () => {
            vigente = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [periodo, orden, tipo]);

    const verMas = async () => {
        if (cargandoMas) return;
        if (ultima) {
            anunciar('Ya están todos los síntomas en la lista.');
            return;
        }
        setCargandoMas(true);
        try {
            const datos = await cargarLista(true);
            anunciar(`Se cargaron ${datos.contenido.length} síntomas más.`);
        } catch (e) {
            anunciar(mensajeDeError(e, 'No pudimos cargar más síntomas.'));
        } finally {
            setCargandoMas(false);
        }
    };

    /** Cambia un filtro; si fue por voz, al cargar se dice el resultado. */
    const filtrarPorVoz = (cambio: () => void) => {
        anunciarResultadoRef.current = true;
        cambio();
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

    const leerResumen = () => anunciar(resumen ? resumen.textoLectura : 'Todavía estoy cargando el resumen.');
    const deQuien = nombrePaciente ? ` de ${nombrePaciente}` : '';
    const tiposFiltro = tipos.slice(0, TIPOS_EN_FILTRO);
    // El tipo elegido por voz se muestra aunque no sea de los más frecuentes
    if (tipo && !tiposFiltro.includes(tipo)) tiposFiltro.push(tipo);

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
            ejecutar: () =>
                filtrarPorVoz(() => {
                    setPeriodo('todo');
                    setTipo(null);
                    setOrden('RECIENTES');
                }),
        },
        {
            frases: ['mas intensos', 'mas fuertes', 'por intensidad', 'ordena por intensidad'],
            ejecutar: () => filtrarPorVoz(() => setOrden('INTENSIDAD')),
        },
        { frases: ['mas recientes', 'recientes primero'], ejecutar: () => filtrarPorVoz(() => setOrden('RECIENTES')) },
        { frases: ['mas antiguos', 'antiguos primero'], ejecutar: () => filtrarPorVoz(() => setOrden('ANTIGUOS')) },
    ];

    /** "Solo mareo", "muestra dolor de cabeza": filtra por un tipo de síntoma. */
    const filtrarPorTipo = (texto: string): Resultado[] | null => {
        const pedido = /^(?:solo|solamente|muestrame solo|filtra(?: por)?|ver solo)\s+(?:los? |las? |de )*(.+)$/.exec(aPalabras(texto));
        if (!pedido) return null;
        // "solo esta semana", "solo los más intensos": son filtros de periodo u orden, no un síntoma
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

    useComandosPantalla({
        titulo: `${titulo}`,
        descripcion: fuente.editable
            ? `${titulo}. Aquí registras cómo te sientes y ves tu historial. Puedes decir: registra dolor de cabeza intensidad 7, lee la lista, lee el resumen o ver evolución.`
            : `${titulo}. Solo puedes consultarlos. Puedes decir: lee el resumen, lee la lista, abre el número 1 o ver evolución.`,
        ejemplos: [
            ...(fuente.editable ? ['registra dolor de cabeza intensidad 7 hace dos horas'] : []),
            'lee el resumen',
            'lee la lista',
            'abre el número 1',
            'solo esta semana',
            'los más intensos',
            ...(tipos[0] ? [`solo ${tipos[0].toLowerCase()}`] : []),
            'ver evolución',
        ],
        campos: [],
        listas: [
            {
                claves: ['mis sintomas', 'lee la lista', 'lee los sintomas', 'historial', 'lista', 'sintomas', 'que he registrado'],
                nombre: `Síntomas${deQuien}${describirFiltro(periodo, tipo, orden) ? `, ${describirFiltro(periodo, tipo, orden)}` : ''}`,
                vacia: `No hay síntomas${describirFiltro(periodo, tipo, orden) ? ` ${describirFiltro(periodo, tipo, orden)}` : ' registrados todavía'}.`,
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
            ...(fuente.editable && fuente.rutas.nuevo
                ? [
                    {
                        frases: ['registrar sintoma', 'registrar un sintoma', 'registra un sintoma', 'nuevo sintoma', 'anotar sintoma', 'anotar un sintoma', 'agregar sintoma', 'agregar un sintoma', 'registrar', 'anotar'],
                        etiqueta: 'registrar un síntoma',
                        ejecutar: () => router.push(fuente.rutas.nuevo!),
                    },
                ]
                : []),
            { frases: ['lee el resumen', 'resumen', 'como voy', 'como he estado', 'como estoy', 'como esta'], etiqueta: 'leer el resumen', ejecutar: leerResumen },
            {
                frases: ['ver evolucion', 'ver la evolucion', 'evolucion', 'grafica', 'como ha cambiado', 'tendencia'],
                etiqueta: 'ver la evolución',
                ejecutar: () => router.push(fuente.rutas.evolucion),
            },
            ...accionesFiltro,
            { frases: ['ver mas', 'cargar mas', 'mas sintomas', 'siguientes'], ejecutar: () => void verMas() },
            // El profesional solo consulta: si pide modificar, se le explica
            ...(!fuente.editable
                ? [
                    {
                        frases: ['eliminar', 'elimina', 'eliminalo', 'borrar', 'borra', 'editar', 'edita', 'cambiar', 'cambia', 'modificar', 'registrar', 'registra', 'nuevo sintoma'],
                        ejecutar: () => anunciar('Solo puedes consultar los síntomas del paciente. Solo el paciente puede registrarlos, editarlos o eliminarlos.'),
                    },
                ]
                : []),
            ...(alVolver ? [{ frases: ['volver', 'atras', 'regresar', 'mis pacientes', 've a mis pacientes'], ejecutar: alVolver }] : []),
            ...accionesComunesVoz(fuente.rol, anunciar),
        ],
        dictado: (texto) => {
            const porTipo = filtrarPorTipo(texto);
            if (porTipo) return porTipo;
            if (!fuente.editable || !fuente.rutas.nuevo) return null;
            // "Registra dolor de cabeza intensidad 7 hace dos horas": abre el formulario ya lleno
            const dictado = separarSintoma(texto, true);
            if (!dictado) return null;
            const params: Record<string, string> = {};
            if (dictado.tipo) params.tipo = dictado.tipo;
            if (dictado.intensidad) params.intensidad = String(dictado.intensidad);
            if (dictado.cuando) params.cuando = dictado.cuando;
            return [
                {
                    tipo: 'accion',
                    indice: -1,
                    accion: { frases: [], ejecutar: () => router.push({ pathname: '/paciente/sintomas/nuevo', params }) },
                },
            ];
        },
    });

    return (
        <FondoPantalla>
            <Encabezado
                volver={!!alVolver}
                alVolver={alVolver}
                alCerrarSesion={() => salir(anunciar)}
                icono={alVolver ? undefined : icono}
                titulo={titulo}
                subtitulo={subtitulo}
            />

            {aviso && (
                <View style={styles.aviso}>
                    <Aviso tipo={aviso.tipo} mensaje={aviso.mensaje} />
                </View>
            )}

            {fuente.editable && fuente.rutas.nuevo && (
                <View style={styles.registrar}>
                    <Boton titulo="Registrar síntoma" icono="agregar" onPress={() => router.push(fuente.rutas.nuevo!)} />
                </View>
            )}

            <Tarjeta titulo="Últimos 30 días" icono="grafica">
                {resumen ? (
                    <ResumenSintomas resumen={resumen} />
                ) : (
                    <EstadoCarga cargando={cargando} error={error} reintentar={cargar} hayDatos={false} />
                )}
                <Boton titulo="Ver evolución" icono="grafica" variante="secundario" onPress={() => router.push(fuente.rutas.evolucion)} />
            </Tarjeta>

            <Tarjeta
                titulo="Historial"
                icono="reloj"
                extra={
                    total > 0 ? (
                        <Texto variante="subtitulo" color="primario" accessibilityLabel={`${total} síntomas`}>
                            {total}
                        </Texto>
                    ) : null
                }>
                <View style={styles.filtros}>
                    <OpcionesFiltro etiqueta="Periodo" opciones={PERIODOS} valor={periodo} onCambiar={setPeriodo} />
                    <OpcionesFiltro etiqueta="Orden" opciones={ORDENES.slice(0, 2)} valor={orden === 'ANTIGUOS' ? 'RECIENTES' : orden} onCambiar={setOrden} />
                    {tiposFiltro.length > 1 && (
                        <OpcionesFiltro
                            etiqueta="Síntoma"
                            opciones={[{ valor: '', titulo: 'Todos' }, ...tiposFiltro.map((t) => ({ valor: t, titulo: t }))]}
                            valor={tipo ?? ''}
                            onCambiar={(valor) => setTipo(valor || null)}
                        />
                    )}
                </View>

                <EstadoCarga
                    cargando={cargando}
                    error={resumen ? error : null}
                    reintentar={cargar}
                    hayDatos={sintomas.length > 0}
                    vacio={
                        describirFiltro(periodo, tipo, orden)
                            ? 'No hay síntomas con estos filtros.'
                            : fuente.editable
                                ? 'Todavía no has registrado síntomas. Toca «Registrar síntoma» o di: Oye VITA, registra dolor de cabeza intensidad 5.'
                                : 'Este paciente todavía no ha registrado síntomas.'
                    }
                />

                <View style={styles.lista}>
                    {sintomas.map((s, i) => (
                        <ElementoSintoma key={s.id} sintoma={s} numero={i + 1} onPress={() => router.push(fuente.rutas.detalle(s.id))} />
                    ))}
                </View>

                {!ultima && <Boton titulo="Ver más síntomas" variante="secundario" cargando={cargandoMas} onPress={verMas} />}
            </Tarjeta>
        </FondoPantalla>
    );
}

const styles = StyleSheet.create({
    aviso: {
        marginBottom: Espacio.l,
    },
    registrar: {
        marginBottom: Espacio.l,
    },
    filtros: {
        gap: Espacio.s,
    },
    lista: {
        gap: Espacio.m,
    },
});