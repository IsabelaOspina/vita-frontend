import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Espacio, Radio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';
import { useComandosPantalla } from '@/context/asistente-context';
import type { AgrupacionTiempo } from '@/dto/AgrupacionTiempo';
import type { SintomaEvolucionPunto } from '@/dto/SintomaEvolucionPunto';
import type { SintomaEvolucionResponse } from '@/dto/SintomaEvolucionResponse';
import type { Tendencia } from '@/dto/Tendencia';
import { aPalabras, type AccionVoz, type Resultado } from '@/utils/comandos-voz';
import { diasAtras } from '@/utils/fechas';
import type { FuenteSintomas } from '@/utils/fuente-sintomas';
import { mensajeDeError } from '@/utils/sesion';
import { decimal, nombreNivel } from '@/utils/sintomas';

import { accionesComunesVoz } from './acciones-cuenta';
import { Encabezado } from './encabezado';
import { EstadoCarga } from './estado-carga';
import { FondoPantalla } from './fondo-pantalla';
import { ControlSegmentado } from './control-segmentado';
import { etiquetaPunto, GraficaEvolucion, lecturaPunto, nivelDePunto } from './grafica-evolucion';
import { Icono, type NombreIcono } from './icono';
import { coloresNivel } from './insignia-intensidad';
import { OpcionesFiltro } from './opciones-filtro';
import { Tarjeta } from './tarjeta';
import { Texto } from './texto';

type Rango = 'semana' | 'mes' | 'trimestre' | 'anio';

const RANGOS: { valor: Rango; titulo: string; dias: number }[] = [
    { valor: 'semana', titulo: '7 días', dias: 6 },
    { valor: 'mes', titulo: '30 días', dias: 29 },
    { valor: 'trimestre', titulo: '3 meses', dias: 89 },
    { valor: 'anio', titulo: '1 año', dias: 364 },
];

const NOMBRE_RANGO: Record<Rango, string> = {
    semana: 'Últimos 7 días',
    mes: 'Últimos 30 días',
    trimestre: 'Últimos 3 meses',
    anio: 'Último año',
};

/** Cómo se agrupa cada periodo para que la gráfica tenga pocos puntos y se lea bien. */
const AGRUPACION_DE_RANGO: Record<Rango, AgrupacionTiempo> = {
    semana: 'DIA',
    mes: 'DIA',
    trimestre: 'SEMANA',
    anio: 'MES',
};

const TITULO_AGRUPACION: Record<AgrupacionTiempo, string> = {
    DIA: 'Intensidad por día',
    SEMANA: 'Intensidad por semana',
    MES: 'Intensidad por mes',
};

/** La frase grande de la tendencia. */
const TITULO_TENDENCIA: Record<Tendencia, string> = {
    MEJORANDO: 'Va mejorando',
    EMPEORANDO: 'Va empeorando',
    ESTABLE: 'Se mantiene estable',
    SIN_DATOS: 'Aún no hay suficientes datos',
};

/** "La intensidad promedio bajó de 8 a 2 en los últimos 30 días." */
function fraseCambio(puntos: SintomaEvolucionPunto[], rango: Rango): string {
    const periodo = NOMBRE_RANGO[rango].toLowerCase().replace(/^últimos?/, (m) => `en los ${m}`).replace('en los último año', 'en el último año');
    if (puntos.length === 0) return `No hay registros ${periodo.replace(/^en /, 'en ')}.`;
    if (puntos.length === 1) return `Solo hay un periodo con registros ${periodo}.`;
    const primero = Math.round(puntos[0].intensidadPromedio * 10) / 10;
    const ultimo = Math.round(puntos[puntos.length - 1].intensidadPromedio * 10) / 10;
    if (primero === ultimo) return `La intensidad promedio se mantuvo en ${decimal(primero)} ${periodo}.`;
    return `La intensidad promedio ${ultimo < primero ? 'bajó' : 'subió'} de ${decimal(primero)} a ${decimal(ultimo)} ${periodo}.`;
}

const ICONO_TENDENCIA: Record<Tendencia, NombreIcono> = {
    MEJORANDO: 'mejorando',
    EMPEORANDO: 'empeorando',
    ESTABLE: 'estable',
    SIN_DATOS: 'info',
};

type Props = {
    fuente: FuenteSintomas;
    titulo: string;
};

/**
 * Evolución de los síntomas: intensidad promedio por día, semana o mes, y la tendencia del
 * periodo (mejorando, estable o empeorando). Se puede ver todo junto o un solo síntoma.
 */
export function PantallaEvolucion({ fuente, titulo }: Props) {
    const { anunciar, leer, colores, altoContraste } = useAccesibilidad();

    const [tipos, setTipos] = useState<string[]>([]);
    const [tipo, setTipo] = useState<string | null>(null);
    const [rango, setRango] = useState<Rango>('mes');
    // La agrupación sale del periodo (7 y 30 días: por día; 3 meses: por semana; 1 año: por mes).
    // Por voz todavía se puede pedir otra ("por semana").
    const [agrupacion, setAgrupacion] = useState<AgrupacionTiempo>('DIA');
    const [datos, setDatos] = useState<SintomaEvolucionResponse | null>(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);

    /** La primera vez se lee la evolución después del nombre de la pantalla; si se cambió por voz, de una vez. */
    const leerAlCargarRef = useRef<'cola' | 'ahora' | null>('cola');

    const volver = () => (router.canGoBack() ? router.back() : router.replace(fuente.rutas.lista));

    useEffect(() => {
        fuente
            .tipos()
            .then(setTipos)
            .catch(() => setTipos([]));
    }, [fuente]);

    const cargar = async () => {
        setCargando(true);
        setError(null);
        try {
            const dias = RANGOS.find((r) => r.valor === rango)?.dias ?? 29;
            const respuesta = await fuente.evolucion(tipo ?? undefined, diasAtras(dias), agrupacion);
            setDatos(respuesta);
            if (leerAlCargarRef.current === 'cola') leer(respuesta.textoLectura, true);
            if (leerAlCargarRef.current === 'ahora') anunciar(respuesta.textoLectura);
            leerAlCargarRef.current = null;
        } catch (e) {
            const mensaje = mensajeDeError(e, 'No pudimos cargar la evolución.');
            setError(mensaje);
            if (leerAlCargarRef.current === 'ahora') anunciar(mensaje);
            leerAlCargarRef.current = null;
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        void cargar();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tipo, rango, agrupacion]);

    /** Cambio pedido por voz: al cargar se lee el resultado. */
    const cambiarPorVoz = (cambio: () => void) => {
        leerAlCargarRef.current = 'ahora';
        cambio();
    };

    const elegirRango = (valor: Rango) => {
        setAgrupacion(AGRUPACION_DE_RANGO[valor]);
        setRango(valor);
    };

    const acciones: AccionVoz[] = [
        {
            frases: ['lee la evolucion', 'lee la tendencia', 'como voy', 'como va', 'tendencia', 'que dice', 'lee el resumen'],
            etiqueta: 'leer la evolución',
            ejecutar: () => anunciar(datos ? datos.textoLectura : 'Todavía estoy cargando la evolución.'),
        },
        { frases: ['por dia', 'por dias', 'cada dia', 'diaria'], ejecutar: () => cambiarPorVoz(() => setAgrupacion('DIA')) },
        { frases: ['por semana', 'por semanas', 'cada semana', 'semanal'], ejecutar: () => cambiarPorVoz(() => setAgrupacion('SEMANA')) },
        { frases: ['por mes', 'por meses', 'cada mes', 'mensual'], ejecutar: () => cambiarPorVoz(() => setAgrupacion('MES')) },
        { frases: ['ultima semana', 'esta semana', 'ultimos 7 dias', 'ultimos siete dias'], ejecutar: () => cambiarPorVoz(() => elegirRango('semana')) },
        { frases: ['ultimo mes', 'este mes', 'ultimos 30 dias', 'ultimos treinta dias'], ejecutar: () => cambiarPorVoz(() => elegirRango('mes')) },
        { frases: ['ultimos 3 meses', 'ultimos tres meses', 'trimestre'], ejecutar: () => cambiarPorVoz(() => elegirRango('trimestre')) },
        { frases: ['ultimo ano', 'este ano', 'ultimos 12 meses', 'ultimos doce meses', 'un ano'], ejecutar: () => cambiarPorVoz(() => elegirRango('anio')) },
        { frases: ['todos los sintomas', 'todos juntos', 'ver todos', 'todos'], ejecutar: () => cambiarPorVoz(() => setTipo(null)) },
        { frases: ['volver', 'atras', 'regresar', 'ir a la lista', 'historial'], ejecutar: volver },
        ...accionesComunesVoz(fuente.rol, anunciar),
    ];

    /** "Cómo voy con el dolor de cabeza", "solo mareo": elige un síntoma. */
    const dictado = (texto: string): Resultado[] | null => {
        const pedido = /^(?:como (?:voy|va|vamos|esta|ha estado|he estado) (?:con )?|solo |solamente |ver |muestra(?:me)? |evolucion de(?:l)? )(?:el |la |los |las |mi |mis )?(.+)$/.exec(
            aPalabras(texto),
        );
        if (!pedido) return null;
        const buscado = pedido[1];
        const encontrado = tipos.find((t) => aPalabras(t) === buscado) ?? tipos.find((t) => aPalabras(t).includes(buscado) || buscado.includes(aPalabras(t)));
        if (!encontrado) return null;
        return [{ tipo: 'accion', indice: -1, accion: { frases: [], ejecutar: () => cambiarPorVoz(() => setTipo(encontrado)) } }];
    };

    const puntos = datos?.puntos ?? [];

    useComandosPantalla({
        titulo,
        descripcion: `${titulo}. Puedes decir: lee la evolución, por semana, último año, cómo voy con un síntoma, o lee la gráfica.`,
        ejemplos: [
            'lee la evolución',
            ...(tipos[0] ? [`cómo voy con el ${tipos[0].toLowerCase()}`] : []),
            'por semana',
            'últimos 3 meses',
            'todos los síntomas',
            'lee la gráfica',
        ],
        campos: [],
        listas: [
            {
                claves: ['lee la grafica', 'lee los datos', 'dia por dia', 'semana por semana', 'mes por mes', 'detalle de la grafica', 'grafica'],
                nombre: 'La gráfica',
                vacia: 'No hay registros en este periodo.',
                elementos: puntos.map((p) => ({ nombre: etiquetaPunto(p, agrupacion), detalle: lecturaPunto(p, agrupacion).split(': ')[1] })),
            },
            {
                claves: ['que sintomas hay', 'lista de sintomas', 'tipos de sintomas', 'cuales sintomas'],
                nombre: 'Síntomas que puedes ver',
                vacia: 'Todavía no hay síntomas registrados.',
                elementos: tipos.map((t) => ({ nombre: t })),
                acciones: [{ frases: ['ver', 'elige', 'escoge', 'abre'], ejecutar: (i) => cambiarPorVoz(() => setTipo(tipos[i])) }],
            },
        ],
        acciones,
        dictado,
    });

    const tendencia = datos?.tendencia ?? 'SIN_DATOS';
    const colorTendencia =
        tendencia === 'MEJORANDO' ? colores.exito : tendencia === 'EMPEORANDO' ? colores.error : colores.textoSecundario;
    const fondoTendencia =
        tendencia === 'MEJORANDO' ? colores.exitoFondo : tendencia === 'EMPEORANDO' ? colores.errorFondo : colores.superficieSuave;

    // Los tres números del periodo, calculados de los mismos puntos de la gráfica
    const registros = puntos.reduce((total, p) => total + p.cantidad, 0);
    const promedio = registros ? puntos.reduce((total, p) => total + p.intensidadPromedio * p.cantidad, 0) / registros : null;
    const maximo = puntos.length ? Math.max(...puntos.map((p) => p.intensidadMaxima)) : null;
    const cifras = [
        { valor: promedio === null ? '—' : decimal(promedio), nombre: 'promedio' },
        { valor: maximo === null ? '—' : String(maximo), nombre: 'máximo' },
        { valor: String(registros), nombre: registros === 1 ? 'registro' : 'registros' },
    ];

    return (
        <FondoPantalla>
            <Encabezado volver alVolver={volver} titulo={titulo} subtitulo="¿Cómo ha cambiado la intensidad?" />

            {/* Filtros arriba: cambian todo lo que se ve debajo */}
            <Tarjeta>
                <View style={styles.filtros}>
                    <Texto variante="etiqueta">Síntoma</Texto>
                    <OpcionesFiltro
                        etiqueta="Síntoma"
                        opciones={[{ valor: '', titulo: 'Todos' }, ...tipos.map((t) => ({ valor: t, titulo: t }))]}
                        valor={tipo ?? ''}
                        onCambiar={(valor) => setTipo(valor || null)}
                    />
                    <Texto variante="etiqueta" style={styles.separado}>
                        Periodo
                    </Texto>
                    <ControlSegmentado etiqueta="Periodo" opciones={RANGOS} valor={rango} onCambiar={elegirRango} />
                </View>
            </Tarjeta>

            <EstadoCarga cargando={cargando} error={error} reintentar={cargar} hayDatos={!!datos} />

            {datos && (
                <>
                    {/* La respuesta primero: ¿voy mejorando? */}
                    <Tarjeta>
                        <View style={styles.respuesta} accessible accessibilityLabel={`${TITULO_TENDENCIA[tendencia]}. ${datos.textoLectura}`}>
                            <View style={[styles.iconoTendencia, { backgroundColor: fondoTendencia, borderColor: colorTendencia }]}>
                                <Icono nombre={ICONO_TENDENCIA[tendencia]} tamano={30} color={colorTendencia} />
                            </View>
                            <View style={styles.textosRespuesta}>
                                <Texto variante="subtitulo" peso="800" style={{ color: colorTendencia }}>
                                    {TITULO_TENDENCIA[tendencia]}
                                </Texto>
                                <Texto variante="etiqueta" peso="400" color="textoSecundario">
                                    {tipo ? `${tipo}. ` : ''}
                                    {fraseCambio(puntos, rango)}
                                </Texto>
                            </View>
                        </View>
                        <View style={styles.cifras}>
                            {cifras.map((c) => (
                                <View
                                    key={c.nombre}
                                    style={[styles.cifra, { borderColor: colores.borde }]}
                                    accessible
                                    accessibilityLabel={`${c.nombre}: ${c.valor}`}>
                                    <Texto variante="subtitulo" peso="800" centrado>
                                        {c.valor}
                                    </Texto>
                                    <Texto variante="pequeno" color="textoSecundario" centrado>
                                        {c.nombre}
                                    </Texto>
                                </View>
                            ))}
                        </View>
                    </Tarjeta>

                    {puntos.length > 0 && (
                        <Tarjeta titulo={TITULO_AGRUPACION[agrupacion]} icono="grafica">
                            <GraficaEvolucion puntos={puntos} agrupacion={agrupacion} descripcion={datos.textoLectura} />
                        </Tarjeta>
                    )}

                    {puntos.length > 0 && (
                        <Tarjeta titulo="Detalle" icono="reloj">
                            {/* La misma información de la gráfica en filas cortas, de lo más reciente a lo más antiguo */}
                            {[...puntos].reverse().map((p) => {
                                const nivel = nivelDePunto(p);
                                const { color } = coloresNivel(nivel, colores, altoContraste);
                                return (
                                    <View
                                        key={p.inicio}
                                        style={styles.filaDetalle}
                                        accessible
                                        accessibilityLabel={`${lecturaPunto(p, agrupacion)}, ${nombreNivel(nivel).toLowerCase()}`}>
                                        <Texto variante="pequeno" peso="600" style={styles.fechaDetalle} numberOfLines={2}>
                                            {etiquetaPunto(p, agrupacion)}
                                        </Texto>
                                        <View style={[styles.pista, { backgroundColor: colores.superficieSuave, borderColor: colores.borde }]}>
                                            <View
                                                style={[
                                                    styles.relleno,
                                                    { width: `${Math.max(4, (p.intensidadPromedio / 10) * 100)}%`, backgroundColor: color },
                                                ]}
                                            />
                                        </View>
                                        <Texto variante="etiqueta" peso="800" style={styles.valorDetalle}>
                                            {decimal(p.intensidadPromedio)}
                                        </Texto>
                                    </View>
                                );
                            })}
                        </Tarjeta>
                    )}
                </>
            )}
        </FondoPantalla>
    );
}

const styles = StyleSheet.create({
    filtros: {
        gap: Espacio.s,
    },
    separado: {
        marginTop: Espacio.s,
    },
    respuesta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Espacio.m,
    },
    iconoTendencia: {
        width: 60,
        height: 60,
        borderRadius: Radio.m,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    textosRespuesta: {
        flex: 1,
        gap: 2,
    },
    cifras: {
        flexDirection: 'row',
        gap: Espacio.s,
    },
    cifra: {
        flex: 1,
        borderWidth: 1.5,
        borderRadius: Radio.m,
        paddingVertical: Espacio.s,
        paddingHorizontal: Espacio.xs,
    },
    filaDetalle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Espacio.s,
        minHeight: 36,
    },
    fechaDetalle: {
        width: 104,
    },
    pista: {
        flex: 1,
        height: 14,
        borderRadius: 7,
        borderWidth: 1,
        overflow: 'hidden',
    },
    relleno: {
        height: '100%',
        borderRadius: 7,
    },
    valorDetalle: {
        width: 34,
        textAlign: 'right',
    },
});