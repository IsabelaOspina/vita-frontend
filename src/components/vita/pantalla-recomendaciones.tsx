import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Espacio, Radio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';
import { useAsistente, useComandosPantalla } from '@/context/asistente-context';
import type { RecomendacionResponse } from '@/dto/RecomendacionResponse';
import { listarMisRecomendaciones, marcarRecomendacionLeida } from '@/services/recomendacionService';
import { fechaHoraCorta } from '@/utils/fechas';
import { sinPuntoDoble } from '@/utils/salud';
import { mensajeDeError } from '@/utils/sesion';

import { accionesComunesVoz } from './acciones-cuenta';
import { Aviso } from './aviso';
import { Boton } from './boton';
import { Encabezado } from './encabezado';
import { EstadoCarga } from './estado-carga';
import { FondoPantalla } from './fondo-pantalla';
import { Icono } from './icono';
import { Tarjeta } from './tarjeta';
import { Texto } from './texto';

/** Quién la escribió: "Dra. Laura Restrepo, Medicina general". */
const autor = (r: RecomendacionResponse) => `${r.profesionalNombre}${r.especialidad ? `, ${r.especialidad}` : ''}`;

/**
 * Recomendaciones que el personal de salud le dejó al paciente. Las nuevas van primero;
 * se marcan como leídas al escucharlas o con "Entendido".
 */
export function PantallaRecomendaciones() {
    const { anunciar, colores } = useAccesibilidad();
    const { avisar } = useAsistente();

    const [lista, setLista] = useState<RecomendacionResponse[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [aviso, setAviso] = useState<{ tipo: 'exito' | 'error'; mensaje: string } | null>(null);

    const cargar = useCallback(async () => {
        setCargando(true);
        setError(null);
        try {
            const pagina = await listarMisRecomendaciones(false, 0, 50);
            setLista(pagina.contenido);
        } catch (e) {
            setError(mensajeDeError(e, 'No pudimos cargar tus recomendaciones.'));
        } finally {
            setCargando(false);
        }
    }, []);

    const cargarRef = useRef(cargar);
    cargarRef.current = cargar;
    useFocusEffect(
        useCallback(() => {
            void cargarRef.current();
        }, []),
    );

    const nuevas = lista.filter((r) => !r.leida);
    const anteriores = lista.filter((r) => r.leida);
    const ordenadas = [...nuevas, ...anteriores];

    const marcarLeida = async (r: RecomendacionResponse, conAviso = true) => {
        if (r.leida) return;
        try {
            const actualizada = await marcarRecomendacionLeida(r.id);
            setLista((antes) => antes.map((x) => (x.id === r.id ? actualizada : x)));
            if (conAviso) {
                const mensaje = 'Listo, la recomendación quedó marcada como leída.';
                setAviso({ tipo: 'exito', mensaje });
                anunciar(mensaje);
            }
        } catch (e) {
            const mensaje = mensajeDeError(e, 'No pudimos marcar la recomendación.');
            setAviso({ tipo: 'error', mensaje });
            anunciar(mensaje);
        }
    };

    /** Lee en voz alta (aunque el modo voz esté apagado) y la marca como leída. */
    const escuchar = (r: RecomendacionResponse) => {
        avisar(sinPuntoDoble(r.textoLectura || `${autor(r)} te recomienda: ${r.mensaje}`));
        void marcarLeida(r, false);
    };

    /** "Lee mis recomendaciones": lee las nuevas (o la más reciente si no hay nuevas) y las marca como leídas. */
    const leerNuevas = () => {
        if (lista.length === 0) {
            anunciar('Todavía no tienes recomendaciones de tu personal de salud.');
            return;
        }
        const aLeer = nuevas.length ? nuevas : lista.slice(0, 1);
        const intro = nuevas.length
            ? `Tienes ${nuevas.length === 1 ? '1 recomendación nueva' : `${nuevas.length} recomendaciones nuevas`}.`
            : 'No tienes recomendaciones nuevas. La más reciente es:';
        avisar(sinPuntoDoble(`${intro} ${aLeer.map((r) => r.textoLectura || `${autor(r)} te recomienda: ${r.mensaje}`).join(' ')}`));
        aLeer.forEach((r) => void marcarLeida(r, false));
    };

    useComandosPantalla({
        titulo: 'Recomendaciones',
        descripcion:
            lista.length === 0
                ? 'Recomendaciones. Todavía no tienes recomendaciones de tu personal de salud.'
                : `Recomendaciones. ${nuevas.length ? `Tienes ${nuevas.length === 1 ? '1 nueva' : `${nuevas.length} nuevas`}` : 'No tienes recomendaciones nuevas'} de ${lista.length === 1 ? '1 en total' : `${lista.length} en total`}. Puedes decir: lee mis recomendaciones, o lee la número 1.`,
        cargando,
        ejemplos: ['lee mis recomendaciones', 'lee la número 1', 'marca la 1 como leída', 'volver'],
        campos: [],
        listas: [
            {
                claves: ['lee la lista', 'todas las recomendaciones', 'lista de recomendaciones'],
                nombre: 'Recomendaciones',
                vacia: 'Todavía no tienes recomendaciones.',
                elementos: ordenadas.map((r) => ({
                    nombre: autor(r),
                    detalle: `${fechaHoraCorta(r.fechaCreacion)}${r.leida ? '' : ', nueva'}: ${r.mensaje}`,
                })),
                acciones: [
                    { frases: ['lee', 'leer', 'escuchar', 'abre', 'ver'], ejecutar: (i) => escuchar(ordenadas[i]) },
                    {
                        frases: ['marca como leida', 'marcar como leida', 'leida', 'entendido'],
                        noAplica: (i) => (ordenadas[i].leida ? 'Esa recomendación ya estaba leída.' : null),
                        ejecutar: (i) => void marcarLeida(ordenadas[i]),
                    },
                ],
            },
        ],
        acciones: [
            {
                frases: ['lee mis recomendaciones', 'lee las nuevas', 'que me recomendaron', 'leer recomendaciones', 'recomendaciones nuevas'],
                etiqueta: 'leer las recomendaciones nuevas',
                ejecutar: leerNuevas,
            },
            { frases: ['volver', 'atras', 'regresar'], ejecutar: () => (router.canGoBack() ? router.back() : router.replace('/paciente/salud')) },
            ...accionesComunesVoz('USUARIO', anunciar),
        ],
    });

    return (
        <FondoPantalla>
            <Encabezado
                volver
                alVolver={() => router.replace('/paciente/salud')}
                icono="medico"
                titulo="Recomendaciones"
                subtitulo="Lo que te recomienda tu personal de salud"
            />

            {aviso && (
                <View style={styles.aviso}>
                    <Aviso tipo={aviso.tipo} mensaje={aviso.mensaje} />
                </View>
            )}

            <EstadoCarga
                cargando={cargando && lista.length === 0}
                error={error}
                reintentar={cargar}
                hayDatos={lista.length > 0}
                vacio="Todavía no tienes recomendaciones. Cuando tu personal de salud te escriba, aparecerán aquí."
            />

            {nuevas.length > 0 && (
                <Tarjeta
                    titulo="Nuevas"
                    icono="campana"
                    extra={
                        <Texto variante="subtitulo" color="primario" accessibilityLabel={`${nuevas.length} nuevas`}>
                            {nuevas.length}
                        </Texto>
                    }
                >
                    <View style={styles.lista}>
                        {nuevas.map((r) => (
                            <ElementoRecomendacion
                                key={r.id}
                                r={r}
                                numero={ordenadas.indexOf(r) + 1}
                                alEscuchar={() => escuchar(r)}
                                alMarcar={() => void marcarLeida(r)}
                            />
                        ))}
                    </View>
                </Tarjeta>
            )}

            {anteriores.length > 0 && (
                <Tarjeta titulo={nuevas.length ? 'Anteriores' : 'Recomendaciones'} icono="nota">
                    <View style={styles.lista}>
                        {anteriores.map((r) => (
                            <ElementoRecomendacion key={r.id} r={r} numero={ordenadas.indexOf(r) + 1} alEscuchar={() => escuchar(r)} />
                        ))}
                    </View>
                </Tarjeta>
            )}
        </FondoPantalla>
    );
}

/** Una recomendación: quién la escribió, cuándo, el mensaje y los botones Escuchar / Entendido. */
function ElementoRecomendacion({
    r,
    numero,
    alEscuchar,
    alMarcar,
}: {
    r: RecomendacionResponse;
    numero: number;
    alEscuchar: () => void;
    alMarcar?: () => void;
}) {
    const { colores } = useAccesibilidad();
    return (
        <View
            style={[styles.elemento, { borderColor: r.leida ? colores.borde : colores.primario, backgroundColor: colores.superficie }]}
            accessibilityLabel={`${numero}. ${autor(r)}, ${fechaHoraCorta(r.fechaCreacion)}${r.leida ? '' : ', nueva'}: ${r.mensaje}`}
        >
            <View style={styles.cabecera}>
                <View style={[styles.avatar, { backgroundColor: colores.superficieSuave }]}>
                    <Icono nombre="medico" tamano={22} color={colores.primario} />
                </View>
                <View style={styles.textos}>
                    <Texto variante="etiqueta" peso="800">
                        {autor(r)}
                    </Texto>
                    <Texto variante="pequeno" color="textoSecundario">
                        {fechaHoraCorta(r.fechaCreacion)}
                    </Texto>
                </View>
                {!r.leida && (
                    <View style={[styles.nueva, { backgroundColor: colores.primario }]}>
                        <Texto variante="pequeno" peso="800" style={{ color: colores.sobrePrimario }}>
                            Nueva
                        </Texto>
                    </View>
                )}
            </View>
            <Texto variante="cuerpo">{r.mensaje}</Texto>
            {r.sintomaReferencia ? (
                <Texto variante="pequeno" color="textoSecundario">
                    Sobre tu síntoma: {r.sintomaReferencia}
                </Texto>
            ) : null}
            <View style={styles.botones}>
                <View style={styles.boton}>
                    <Boton titulo="Escuchar" icono="microfono" variante="secundario" onPress={alEscuchar} pista="Lee la recomendación en voz alta" />
                </View>
                {alMarcar && (
                    <View style={styles.boton}>
                        <Boton titulo="Entendido" icono="check" onPress={alMarcar} pista="Marca la recomendación como leída" />
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    aviso: {
        marginBottom: Espacio.l,
    },
    lista: {
        gap: Espacio.m,
    },
    elemento: {
        borderWidth: 1.5,
        borderRadius: Radio.m,
        padding: Espacio.m,
        gap: Espacio.s,
    },
    cabecera: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Espacio.m,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    textos: {
        flex: 1,
        gap: 2,
    },
    nueva: {
        paddingHorizontal: Espacio.s,
        paddingVertical: 2,
        borderRadius: Radio.s,
    },
    botones: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Espacio.s,
    },
    boton: {
        flexGrow: 1,
        minWidth: 130,
    },
});
