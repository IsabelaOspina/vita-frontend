import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Espacio, Radio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';
import { useComandosPantalla } from '@/context/asistente-context';
import type { RecomendacionResponse } from '@/dto/RecomendacionResponse';
import type { SintomaResponse } from '@/dto/SintomaResponse';
import { crearRecomendacion, listarRecomendacionesDePaciente } from '@/services/recomendacionService';
import { fechaHoraCorta } from '@/utils/fechas';
import type { FuenteSintomas } from '@/utils/fuente-sintomas';
import { mensajeDeError } from '@/utils/sesion';

import { accionesComunesVoz, salir } from './acciones-cuenta';
import { Aviso } from './aviso';
import { Boton } from './boton';
import { Campo, NotaCamposObligatorios } from './campo';
import { Encabezado } from './encabezado';
import { EstadoCarga } from './estado-carga';
import { FondoPantalla } from './fondo-pantalla';
import { Icono } from './icono';
import { Tarjeta } from './tarjeta';
import { Texto } from './texto';

const MAXIMO = 1000;

type Props = {
    pacienteId: number;
    nombre: string;
    fuente: FuenteSintomas;
    /** Si llega, la recomendación queda asociada a ese síntoma del paciente. */
    sintomaId: number | null;
};

/** El profesional escribe una recomendación a su paciente y ve las que ya le envió. */
export function PantallaRecomendacionesProfesional({ pacienteId, nombre, fuente, sintomaId }: Props) {
    const { anunciar, colores } = useAccesibilidad();

    const [mensaje, setMensaje] = useState('');
    const [error, setError] = useState<string | undefined>();
    const [enviando, setEnviando] = useState(false);
    const [aviso, setAviso] = useState<{ tipo: 'exito' | 'error'; mensaje: string } | null>(null);

    const [sintoma, setSintoma] = useState<SintomaResponse | null>(null);
    const [sobreSintoma, setSobreSintoma] = useState(!!sintomaId);

    const [enviadas, setEnviadas] = useState<RecomendacionResponse[]>([]);
    const [cargando, setCargando] = useState(true);
    const [errorCarga, setErrorCarga] = useState<string | null>(null);

    const cargar = useCallback(async () => {
        if (!pacienteId) return;
        setCargando(true);
        setErrorCarga(null);
        try {
            const [pagina, s] = await Promise.all([
                listarRecomendacionesDePaciente(pacienteId, 0, 50),
                sintomaId ? fuente.obtener(sintomaId).catch(() => null) : Promise.resolve(null),
            ]);
            setEnviadas(pagina.contenido);
            setSintoma(s);
        } catch (e) {
            setErrorCarga(mensajeDeError(e, 'No pudimos cargar las recomendaciones.'));
        } finally {
            setCargando(false);
        }
    }, [pacienteId, sintomaId, fuente]);

    const cargarRef = useRef(cargar);
    cargarRef.current = cargar;
    useFocusEffect(
        useCallback(() => {
            void cargarRef.current();
        }, []),
    );

    const volver = () => (router.canGoBack() ? router.back() : router.replace(fuente.rutas.lista));

    const referenciaSintoma = sintoma ? `${sintoma.tipo}, intensidad ${sintoma.intensidad} de 10, ${fechaHoraCorta(sintoma.fechaHora).toLowerCase()}` : null;

    const enviar = async () => {
        const texto = mensaje.trim();
        const encontrado = !texto
            ? 'Escribe la recomendación para el paciente'
            : texto.length > MAXIMO
              ? `La recomendación admite máximo ${MAXIMO} caracteres`
              : undefined;
        setError(encontrado);
        setAviso(null);
        if (encontrado) {
            anunciar(encontrado);
            return;
        }
        setEnviando(true);
        try {
            const creada = await crearRecomendacion(pacienteId, {
                mensaje: texto,
                ...(sobreSintoma && sintomaId ? { sintomaId } : {}),
            });
            setEnviadas((antes) => [creada, ...antes]);
            setMensaje('');
            const listo = `Listo, ${nombre} recibirá tu recomendación en VITA.`;
            setAviso({ tipo: 'exito', mensaje: listo });
            anunciar(listo);
        } catch (e) {
            const texto = mensajeDeError(e, 'No pudimos enviar la recomendación.');
            if (/mensaje|recomendaci/i.test(texto)) setError(texto);
            else setAviso({ tipo: 'error', mensaje: texto });
            anunciar(texto);
        } finally {
            setEnviando(false);
        }
    };

    const leerEnviada = (r: RecomendacionResponse) =>
        `${fechaHoraCorta(r.fechaCreacion)}${r.sintomaReferencia ? `, sobre ${r.sintomaReferencia}` : ''}: ${r.mensaje}. ${r.leida ? 'El paciente ya la leyó.' : 'El paciente todavía no la ha leído.'}`;

    useComandosPantalla({
        titulo: 'Recomendaciones',
        descripcion:
            `Recomendaciones para ${nombre}.` +
            (referenciaSintoma && sobreSintoma ? ` Sobre el síntoma ${referenciaSintoma}.` : '') +
            ` Le has enviado ${enviadas.length === 1 ? '1 recomendación' : `${enviadas.length} recomendaciones`}. Dicta la recomendación y di enviar.`,
        cargando,
        ejemplos: ['la recomendación es tomar abundante agua y descansar', 'enviar', 'lee las enviadas', 'volver'],
        campos: [
            {
                claves: ['la recomendacion es', 'recomendacion', 'mensaje', 'escribe'],
                etiqueta: 'Recomendación',
                pregunta: '¿Qué le recomiendas al paciente?',
                tipo: 'texto',
                valor: mensaje,
                asignar: (v) => {
                    setMensaje(v.charAt(0).toUpperCase() + v.slice(1));
                    setError(undefined);
                },
            },
        ],
        listas: [
            {
                claves: ['lee las enviadas', 'recomendaciones enviadas', 'lee las recomendaciones', 'enviadas', 'lee la lista'],
                nombre: 'Recomendaciones enviadas',
                vacia: 'Todavía no le has enviado recomendaciones a este paciente.',
                elementos: enviadas.map((r) => ({ nombre: fechaHoraCorta(r.fechaCreacion), detalle: leerEnviada(r) })),
            },
        ],
        acciones: [
            { frases: ['enviar', 'enviar recomendacion', 'mandar', 'guardar', 'listo'], etiqueta: 'enviar la recomendación', ejecutar: () => void enviar() },
            ...(sintomaId
                ? [
                      { frases: ['sin sintoma', 'quitar el sintoma', 'no asociar'], ejecutar: () => setSobreSintoma(false) },
                      { frases: ['sobre el sintoma', 'asociar el sintoma'], ejecutar: () => setSobreSintoma(true) },
                  ]
                : []),
            { frases: ['volver', 'atras', 'regresar'], ejecutar: volver },
            ...accionesComunesVoz('PERSONAL_SALUD', anunciar),
        ],
    });

    return (
        <FondoPantalla>
            <Encabezado volver alVolver={volver} alCerrarSesion={() => salir(anunciar)} titulo="Recomendaciones" subtitulo={`Para ${nombre}`} />

            {aviso && (
                <View style={styles.aviso}>
                    <Aviso tipo={aviso.tipo} mensaje={aviso.mensaje} />
                </View>
            )}

            <Tarjeta titulo="Nueva recomendación" icono="nota">
                {sintomaId && referenciaSintoma ? (
                    <Pressable
                        onPress={() => setSobreSintoma((v) => !v)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: sobreSintoma }}
                        accessibilityLabel={`Asociar al síntoma: ${referenciaSintoma}`}
                        style={[styles.sintoma, { borderColor: sobreSintoma ? colores.primario : colores.borde, backgroundColor: colores.superficieSuave }]}
                    >
                        <View style={[styles.casilla, { borderColor: colores.primario, backgroundColor: sobreSintoma ? colores.primario : 'transparent' }]}>
                            {sobreSintoma && <Icono nombre="check" tamano={16} color={colores.sobrePrimario} />}
                        </View>
                        <View style={styles.textos}>
                            <Texto variante="etiqueta" peso="700">
                                Sobre el síntoma
                            </Texto>
                            <Texto variante="pequeno" color="textoSecundario">
                                {referenciaSintoma}
                            </Texto>
                        </View>
                    </Pressable>
                ) : null}
                <Campo
                    etiqueta="Recomendación"
                    obligatorio
                    icono="nota"
                    placeholder="Ej: Tome abundante agua y descanse."
                    numberOfLines={5}
                    textAlignVertical="top"
                    value={mensaje}
                    onChangeText={(v) => {
                        setMensaje(v);
                        setError(undefined);
                    }}
                    error={error}
                    ayuda={`${mensaje.length} de ${MAXIMO} caracteres. El paciente podrá escucharla en voz alta.`}
                    multiline
                    maxLength={MAXIMO}
                />
                <NotaCamposObligatorios />
                <Boton titulo="Enviar recomendación" icono="check" onPress={() => void enviar()} cargando={enviando} />
            </Tarjeta>

            <Tarjeta
                titulo="Enviadas"
                icono="reloj"
                extra={
                    enviadas.length ? (
                        <Texto variante="subtitulo" color="primario" accessibilityLabel={`${enviadas.length} enviadas`}>
                            {enviadas.length}
                        </Texto>
                    ) : null
                }
            >
                <EstadoCarga
                    cargando={cargando}
                    error={errorCarga}
                    reintentar={cargar}
                    hayDatos={enviadas.length > 0}
                    vacio="Todavía no le has enviado recomendaciones a este paciente."
                />
                <View style={styles.lista}>
                    {enviadas.map((r) => (
                        <View
                            key={r.id}
                            accessible
                            accessibilityLabel={leerEnviada(r)}
                            style={[styles.enviada, { borderColor: colores.borde, backgroundColor: colores.superficie }]}
                        >
                            <View style={styles.filaEnviada}>
                                <Texto variante="pequeno" color="textoSecundario" peso="700">
                                    {fechaHoraCorta(r.fechaCreacion)}
                                </Texto>
                                <View style={[styles.estado, { backgroundColor: r.leida ? colores.exitoFondo : colores.superficieSuave }]}>
                                    {r.leida && <Icono nombre="check" tamano={14} color={colores.exito} />}
                                    <Texto variante="pequeno" peso="700" style={{ color: r.leida ? colores.exito : colores.textoSecundario }}>
                                        {r.leida ? 'Leída' : 'Sin leer'}
                                    </Texto>
                                </View>
                            </View>
                            <Texto variante="cuerpo">{r.mensaje}</Texto>
                            {r.sintomaReferencia ? (
                                <Texto variante="pequeno" color="textoSecundario">
                                    Sobre: {r.sintomaReferencia}
                                </Texto>
                            ) : null}
                        </View>
                    ))}
                </View>
            </Tarjeta>
        </FondoPantalla>
    );
}

const styles = StyleSheet.create({
    aviso: {
        marginBottom: Espacio.l,
    },
    sintoma: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Espacio.m,
        borderWidth: 1.5,
        borderRadius: Radio.m,
        padding: Espacio.m,
    },
    casilla: {
        width: 26,
        height: 26,
        borderRadius: 6,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    textos: {
        flex: 1,
        gap: 2,
    },
    lista: {
        gap: Espacio.s,
    },
    enviada: {
        borderWidth: 1.5,
        borderRadius: Radio.m,
        padding: Espacio.m,
        gap: Espacio.xs,
    },
    filaEnviada: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: Espacio.s,
    },
    estado: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: Espacio.s,
        paddingVertical: 2,
        borderRadius: Radio.s,
    },
});
