import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Espacio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';
import { useComandosPantalla } from '@/context/asistente-context';
import type { SintomaResponse } from '@/dto/SintomaResponse';
import type { SintomaResumenResponse } from '@/dto/SintomaResumenResponse';
import type { AccionVoz, Resultado } from '@/utils/comandos-voz';
import { aPalabras } from '@/utils/comandos-voz';
import { fechaHoraCorta } from '@/utils/fechas';
import { tomarAvisoPendiente, type FuenteSintomas } from '@/utils/fuente-sintomas';
import { mensajeDeError } from '@/utils/sesion';
import { separarSintoma } from '@/utils/sintomas';

import { accionesComunesVoz, salir } from './acciones-cuenta';
import { Aviso } from './aviso';
import { Boton } from './boton';
import { ElementoSintoma } from './elemento-sintoma';
import { Encabezado } from './encabezado';
import { EstadoCarga } from './estado-carga';
import { FondoPantalla } from './fondo-pantalla';
import type { NombreIcono } from './icono';
import { ResumenSintomas } from './resumen-sintomas';
import { Tarjeta } from './tarjeta';
import { Texto } from './texto';

/** Cuántos síntomas recientes se muestran aquí; el resto está en el historial. */
const RECIENTES = 3;

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

/**
 * Inicio de los síntomas: resumen de los últimos 30 días y los registros más recientes, con
 * accesos al historial completo y a la evolución (cada uno en su propia página).
 * La usan el paciente (pestaña "Síntomas", puede registrar) y el personal de salud
 * (síntomas de un paciente asignado, solo consulta).
 */
export function PantallaSintomas({ fuente, titulo, subtitulo, icono, nombrePaciente, alVolver }: Props) {
    const { anunciar } = useAccesibilidad();
    const { aviso: avisoRecibido } = useLocalSearchParams<{ aviso?: string }>();

    const [resumen, setResumen] = useState<SintomaResumenResponse | null>(null);
    const [tipos, setTipos] = useState<string[]>([]);
    const [recientes, setRecientes] = useState<SintomaResponse[]>([]);
    const [total, setTotal] = useState(0);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [aviso, setAviso] = useState<{ tipo: 'exito' | 'error'; mensaje: string } | null>(null);

    // Al volver de registrar o editar llega el mensaje para mostrarlo arriba
    useEffect(() => {
        if (!avisoRecibido) return;
        setAviso({ tipo: 'exito', mensaje: avisoRecibido });
        router.setParams({ aviso: undefined });
    }, [avisoRecibido]);

    const cargar = useCallback(async () => {
        setCargando(true);
        setError(null);
        try {
            const [datosResumen, datosTipos, lista] = await Promise.all([
                fuente.resumen(),
                fuente.tipos(),
                fuente.listar({ orden: 'RECIENTES', pagina: 0, tamano: RECIENTES }),
            ]);
            setResumen(datosResumen);
            setTipos(datosTipos);
            setRecientes(lista.contenido);
            setTotal(lista.totalElementos);
        } catch (e) {
            setError(mensajeDeError(e, 'No pudimos cargar los síntomas.'));
        } finally {
            setCargando(false);
        }
    }, [fuente]);

    // Cada vez que se entra a la pantalla (por ejemplo, al volver de registrar o eliminar uno)
    const cargarRef = useRef(cargar);
    cargarRef.current = cargar;
    useFocusEffect(
        useCallback(() => {
            const pendiente = tomarAvisoPendiente();
            if (pendiente) setAviso({ tipo: 'exito', mensaje: pendiente });
            void cargarRef.current();
        }, []),
    );

    const verHistorial = (filtros?: Record<string, string>) => router.push(fuente.rutas.historial(filtros));
    const leerResumen = () => anunciar(resumen ? resumen.textoLectura : 'Todavía estoy cargando el resumen.');
    const deQuien = nombrePaciente ? ` de ${nombrePaciente}` : '';

    // Los filtros por voz ("solo esta semana", "los más intensos") abren el historial ya filtrado
    const accionesFiltro: AccionVoz[] = [
        { frases: ['solo hoy', 'los de hoy', 'sintomas de hoy', 'de hoy'], ejecutar: () => verHistorial({ periodo: 'hoy' }) },
        { frases: ['esta semana', 'ultima semana', 'ultimos 7 dias', 'ultimos siete dias', 'de la semana'], ejecutar: () => verHistorial({ periodo: 'semana' }) },
        { frases: ['este mes', 'ultimo mes', 'ultimos 30 dias', 'ultimos treinta dias', 'del mes'], ejecutar: () => verHistorial({ periodo: 'mes' }) },
        { frases: ['solo leves', 'los leves'], ejecutar: () => verHistorial({ nivel: 'LEVE' }) },
        { frases: ['solo moderados', 'los moderados'], ejecutar: () => verHistorial({ nivel: 'MODERADA' }) },
        { frases: ['solo severos', 'los severos', 'los graves'], ejecutar: () => verHistorial({ nivel: 'SEVERA' }) },
        { frases: ['mas intensos', 'mas fuertes', 'por intensidad', 'ordena por intensidad'], ejecutar: () => verHistorial({ orden: 'INTENSIDAD' }) },
        { frases: ['mas antiguos', 'antiguos primero'], ejecutar: () => verHistorial({ orden: 'ANTIGUOS' }) },
    ];

    /** "Solo mareo": abre el historial de ese síntoma. "Registra dolor de cabeza intensidad 7": abre el formulario lleno. */
    const dictado = (texto: string): Resultado[] | null => {
        const pedido = /^(?:solo|solamente|muestrame solo|filtra(?: por)?|ver solo)\s+(?:los? |las? |de )*(.+)$/.exec(aPalabras(texto));
        if (pedido && !accionesFiltro.some((a) => a.frases.some((f) => pedido[1].includes(f) || f.endsWith(pedido[1])))) {
            const buscado = pedido[1];
            const encontrado = tipos.find((t) => aPalabras(t) === buscado) ?? tipos.find((t) => aPalabras(t).includes(buscado) || buscado.includes(aPalabras(t)));
            return [
                {
                    tipo: 'accion',
                    indice: -1,
                    accion: {
                        frases: [],
                        ejecutar: () =>
                            encontrado ? verHistorial({ tipo: encontrado }) : anunciar(`No encontré síntomas de ${buscado}. Para ver todos, di: ver historial.`),
                    },
                },
            ];
        }
        if (!fuente.editable || !fuente.rutas.nuevo) return null;
        const partes = separarSintoma(texto, true);
        if (!partes) return null;
        const params: Record<string, string> = {};
        if (partes.tipo) params.tipo = partes.tipo;
        if (partes.intensidad) params.intensidad = String(partes.intensidad);
        if (partes.cuando) params.cuando = partes.cuando;
        return [{ tipo: 'accion', indice: -1, accion: { frases: [], ejecutar: () => router.push({ pathname: '/paciente/salud/sintomas/nuevo', params }) } }];
    };

    useComandosPantalla({
        titulo,
        descripcion: fuente.editable
            ? `${titulo}. Aquí registras cómo te sientes. Puedes decir: registra dolor de cabeza intensidad 7, lee el resumen, ver historial o ver evolución.`
            : `${titulo}. Solo puedes consultarlos. Puedes decir: lee el resumen, lee los recientes, ver historial, ver evolución o escribir recomendación.`,
        ejemplos: [
            ...(fuente.editable ? ['registra dolor de cabeza intensidad 7 hace dos horas'] : []),
            'lee el resumen',
            'lee los recientes',
            'ver historial',
            'solo esta semana',
            'ver evolución',
        ],
        campos: [],
        listas: [
            {
                claves: ['lee los recientes', 'recientes', 'ultimos sintomas', 'lee la lista', 'lista', 'mis sintomas', 'sintomas'],
                nombre: `Síntomas más recientes${deQuien}`,
                vacia: fuente.editable ? 'Aún no tienes síntomas registrados.' : 'Este paciente todavía no ha registrado síntomas.',
                elementos: recientes.map((s) => ({
                    nombre: s.tipo,
                    detalle: `intensidad ${s.intensidad} de 10, ${fechaHoraCorta(s.fechaHora).toLowerCase()}`,
                })),
                acciones: [
                    {
                        frases: ['abre', 'abrir', 'ver', 'muestra', 'mostrar', 'muestrame', 'detalle de', 'detalle del'],
                        ejecutar: (i) => router.push(fuente.rutas.detalle(recientes[i].id)),
                    },
                    ...(fuente.editable && fuente.rutas.editar
                        ? [
                              {
                                  frases: ['edita', 'editar', 'cambia', 'cambiar', 'modifica', 'modificar', 'corrige', 'corregir'],
                                  ejecutar: (i: number) => router.push(fuente.rutas.editar!(recientes[i].id)),
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
                frases: ['ver historial', 'ver el historial', 'historial completo', 'abre el historial', 'historial', 'todos mis sintomas', 'ver todos', 'ver todo'],
                etiqueta: 'ver el historial',
                ejecutar: () => verHistorial(),
            },
            {
                frases: ['ver evolucion', 'ver la evolucion', 'evolucion', 'grafica', 'como ha cambiado', 'tendencia'],
                etiqueta: 'ver la evolución',
                ejecutar: () => router.push(fuente.rutas.evolucion),
            },
            ...accionesFiltro,
            // El profesional solo consulta: si pide modificar, se le explica
            ...(!fuente.editable
                ? [
                      {
                          frases: ['eliminar', 'elimina', 'borrar', 'borra', 'editar', 'edita', 'cambiar', 'cambia', 'modificar', 'registrar', 'registra', 'nuevo sintoma'],
                          ejecutar: () => anunciar('Solo puedes consultar los síntomas del paciente. Solo el paciente puede registrarlos, editarlos o eliminarlos.'),
                      },
                  ]
                : []),
            ...(fuente.rutas.recomendar
                ? [
                      {
                          frases: ['escribir recomendacion', 'escribir una recomendacion', 'dejar recomendacion', 'recomendar', 'recomendaciones', 'nueva recomendacion'],
                          etiqueta: 'escribir una recomendación',
                          ejecutar: () => router.push(fuente.rutas.recomendar!()),
                      },
                  ]
                : []),
            ...(alVolver ? [{ frases: ['volver', 'atras', 'regresar', 'mis pacientes', 've a mis pacientes'], ejecutar: alVolver }] : []),
            ...accionesComunesVoz(fuente.rol, anunciar),
        ],
        dictado,
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

            {fuente.rutas.recomendar && (
                <View style={styles.registrar}>
                    <Boton titulo="Recomendaciones al paciente" icono="nota" onPress={() => router.push(fuente.rutas.recomendar!())} />
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
                titulo="Registros recientes"
                icono="reloj"
                extra={
                    total > 0 ? (
                        <Texto variante="subtitulo" color="primario" accessibilityLabel={`${total} síntomas en total`}>
                            {total}
                        </Texto>
                    ) : null
                }>
                <EstadoCarga
                    cargando={cargando && !resumen}
                    error={resumen ? error : null}
                    reintentar={cargar}
                    hayDatos={recientes.length > 0}
                    vacio={fuente.editable ? 'Aún no tienes síntomas registrados.' : 'Este paciente todavía no ha registrado síntomas.'}
                />
                <View style={styles.lista}>
                    {recientes.map((s, i) => (
                        <ElementoSintoma key={s.id} sintoma={s} numero={i + 1} onPress={() => router.push(fuente.rutas.detalle(s.id))} />
                    ))}
                </View>
                {total > 0 && (
                    <Boton
                        titulo="Ver historial completo"
                        icono="siguiente"
                        variante="secundario"
                        onPress={() => verHistorial()}
                    />
                )}
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
    lista: {
        gap: Espacio.m,
    },
});
