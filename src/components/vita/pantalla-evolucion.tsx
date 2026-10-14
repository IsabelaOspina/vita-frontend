import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Espacio, Radio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';
import { useComandosPantalla } from '@/context/asistente-context';
import type { AgrupacionTiempo } from '@/dto/AgrupacionTiempo';
import type { SintomaEvolucionResponse } from '@/dto/SintomaEvolucionResponse';
import type { Tendencia } from '@/dto/Tendencia';
import { aPalabras, type AccionVoz, type Resultado } from '@/utils/comandos-voz';
import { diasAtras } from '@/utils/fechas';
import type { FuenteSintomas } from '@/utils/fuente-sintomas';
import { mensajeDeError } from '@/utils/sesion';
import { nombreTendencia } from '@/utils/sintomas';

import { accionesComunesVoz } from './acciones-cuenta';
import { Encabezado } from './encabezado';
import { EstadoCarga } from './estado-carga';
import { FondoPantalla } from './fondo-pantalla';
import { etiquetaPunto, GraficaEvolucion, lecturaPunto } from './grafica-evolucion';
import { Icono, type NombreIcono } from './icono';
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

const AGRUPACIONES: { valor: AgrupacionTiempo; titulo: string }[] = [
    { valor: 'DIA', titulo: 'Por día' },
    { valor: 'SEMANA', titulo: 'Por semana' },
    { valor: 'MES', titulo: 'Por mes' },
];

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
    const { anunciar, leer, colores } = useAccesibilidad();

    const [tipos, setTipos] = useState<string[]>([]);
    const [tipo, setTipo] = useState<string | null>(null);
    const [rango, setRango] = useState<Rango>('mes');
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
        // Por día, un año serían 365 barras: se agrupa por mes
        if (valor === 'anio' && agrupacion === 'DIA') setAgrupacion('MES');
        if (valor === 'semana' && agrupacion === 'MES') setAgrupacion('DIA');
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

    return (
        <FondoPantalla>
            <Encabezado volver alVolver={volver} titulo={titulo} subtitulo="¿Cómo ha cambiado la intensidad?" />

            <Tarjeta titulo={tipo ?? 'Todos los síntomas'} icono="grafica">
                <Texto variante="pequeno" color="textoSecundario">
                    {NOMBRE_RANGO[rango]} · {AGRUPACIONES.find((x) => x.valor === agrupacion)?.titulo.toLowerCase()}
                </Texto>
                <EstadoCarga cargando={cargando} error={error} reintentar={cargar} hayDatos={!!datos} />
                {datos && (
                    <>
                        <View
                            accessible
                            accessibilityLabel={`Tendencia: ${nombreTendencia(tendencia)}`}
                            style={[styles.tendencia, { backgroundColor: fondoTendencia, borderColor: colorTendencia }]}>
                            <Icono nombre={ICONO_TENDENCIA[tendencia]} tamano={20} color={colorTendencia} />
                            <Texto variante="etiqueta" peso="700" style={{ color: colorTendencia }}>
                                {nombreTendencia(tendencia)}
                            </Texto>
                        </View>

                        {puntos.length > 0 ? (
                            <GraficaEvolucion puntos={puntos} agrupacion={agrupacion} descripcion={datos.textoLectura} />
                        ) : null}

                        <View style={[styles.lectura, { borderLeftColor: colores.primario, backgroundColor: colores.fondo }]}>
                            <Texto variante="etiqueta" peso="400" color="textoSecundario">
                                {datos.textoLectura}
                            </Texto>
                        </View>
                    </>
                )}
            </Tarjeta>

            <Tarjeta titulo="Cambiar lo que ves" icono="ajustes">
                <View style={styles.filtros}>
                    <Texto variante="etiqueta">Síntoma</Texto>
                    <OpcionesFiltro
                        etiqueta="Síntoma"
                        opciones={[{ valor: '', titulo: 'Todos' }, ...tipos.map((t) => ({ valor: t, titulo: t }))]}
                        valor={tipo ?? ''}
                        onCambiar={(valor) => setTipo(valor || null)}
                    />
                    <Texto variante="etiqueta">Periodo</Texto>
                    <OpcionesFiltro etiqueta="Periodo" opciones={RANGOS} valor={rango} onCambiar={elegirRango} />
                    <Texto variante="etiqueta">Agrupar</Texto>
                    <OpcionesFiltro
                        etiqueta="Agrupar"
                        // Un año por día serían demasiadas barras
                        opciones={rango === 'anio' ? AGRUPACIONES.slice(1) : AGRUPACIONES}
                        valor={agrupacion}
                        onCambiar={setAgrupacion}
                    />
                </View>
            </Tarjeta>

            {puntos.length > 0 && (
                <Tarjeta titulo={AGRUPACIONES.find((a) => a.valor === agrupacion)?.titulo ?? 'Detalle'} icono="reloj">
                    {/* La misma información de la gráfica, en texto (para leerla con calma o con lector de pantalla) */}
                    {[...puntos].reverse().map((p) => (
                        <View key={p.inicio} style={[styles.fila, { borderColor: colores.borde }]} accessible accessibilityLabel={lecturaPunto(p, agrupacion)}>
                            <Texto variante="cuerpo" peso="700">
                                {etiquetaPunto(p, agrupacion)}
                            </Texto>
                            <Texto variante="pequeno" color="textoSecundario">
                                {lecturaPunto(p, agrupacion).split(': ')[1]}
                            </Texto>
                        </View>
                    ))}
                </Tarjeta>
            )}
        </FondoPantalla>
    );
}

const styles = StyleSheet.create({
    filtros: {
        gap: Espacio.s,
    },
    tendencia: {
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: Espacio.xs,
        paddingHorizontal: Espacio.m,
        paddingVertical: Espacio.xs,
        borderRadius: Radio.total,
        borderWidth: 1.5,
    },
    lectura: {
        borderLeftWidth: 4,
        borderRadius: Radio.s,
        padding: Espacio.m,
    },
    fila: {
        borderWidth: 1.5,
        borderRadius: Radio.m,
        paddingVertical: Espacio.s,
        paddingHorizontal: Espacio.m,
    },
});