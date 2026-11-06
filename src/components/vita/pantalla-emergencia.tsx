import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Espacio, Radio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';
import { useComandosPantalla } from '@/context/asistente-context';
import type { ContactoEmergenciaResponse } from '@/dto/ContactoEmergenciaResponse';
import type { SolicitudEmergenciaResponse } from '@/dto/SolicitudEmergenciaResponse';
import type { TipoEmergencia } from '@/dto/TipoEmergencia';
import { listarEmergencias, marcarEmergenciaAtendida, obtenerContactoEmergencia, solicitarEmergencia } from '@/services/emergenciaService';
import { aPalabras, type CampoVoz, type Resultado } from '@/utils/comandos-voz';
import {
    interpretarTipoEmergencia,
    LINEA_EMERGENCIAS,
    nombreEstadoEmergencia,
    nombreTipoEmergencia,
    telefonoParaMostrar,
    TIPOS_EMERGENCIA,
} from '@/utils/emergencia';
import { fechaHoraLarga } from '@/utils/fechas';
import { tomarAvisoPendiente } from '@/utils/fuente-sintomas';
import { mensajeDeError } from '@/utils/sesion';
import { abrirAjustesUbicacion, enlaceMapa, obtenerUbicacionActual, type Coordenadas, type UbicacionObtenida } from '@/utils/ubicacion';

import { accionesComunesVoz } from './acciones-cuenta';
import { Aviso } from './aviso';
import { Boton } from './boton';
import { Campo } from './campo';
import { ElementoLista } from './elemento-lista';
import { Encabezado } from './encabezado';
import { EstadoCarga } from './estado-carga';
import { FondoPantalla } from './fondo-pantalla';
import { Icono } from './icono';
import { Tarjeta } from './tarjeta';
import { Texto } from './texto';

/** Cuántas solicitudes anteriores se muestran. */
const ANTERIORES = 5;

/** Respuestas a "¿Le envío la alerta…?" (cuando se pidió ayuda con el botón flotante o la escucha de emergencia). */
const SI = /^(si|claro|dale|ok|okey|listo|correcto|adelante|hazlo|enviala|envia|enviar|si enviala|si envia|si por favor|por favor|si claro)$/;
const NO = /^(no|no gracias|cancelar|cancela|no enviar|no la envies|ya no|ya estoy bien|fue un error|equivocado|me equivoque)$/;

/**
 * La marca "preguntar" lleva el tipo de emergencia dentro ("1730000000000-MEDICA"), para que
 * nunca se mezcle con un tipo que haya quedado de una visita anterior.
 */
function tipoDeLaPregunta(marca: string | undefined): TipoEmergencia | null {
    const tipo = marca?.split('-')[1];
    return TIPOS_EMERGENCIA.some((t) => t.valor === tipo) ? (tipo as TipoEmergencia) : null;
}

/** Abre el marcador del celular con el número. */
function llamar(numero: string) {
    void Linking.openURL(`tel:${numero.replace(/\s/g, '')}`).catch(() => undefined);
}

/** Lo que se muestra y se dice después de pedir ayuda. */
function mensajeDelResultado(r: SolicitudEmergenciaResponse): string {
    const nombre = r.nombreContacto ?? 'tu contacto de emergencia';
    if (r.estado === 'ENVIADA' || r.estado === 'ATENDIDA') {
        return `Listo. Le enviamos un mensaje de texto a ${nombre} avisándole que necesitas ayuda${r.ubicacion || r.latitud != null ? ` y dónde estás` : ''}. Si es grave, llama también al ${LINEA_EMERGENCIAS}.`;
    }
    return `No pudimos enviar el mensaje a ${nombre}. Llámalo tú${r.telefonoContacto ? ` al ${telefonoParaMostrar(r.telefonoContacto)}` : ''}, o llama al ${LINEA_EMERGENCIAS}.`;
}

/**
 * "Pedir ayuda" (paciente): se elige el tipo de emergencia y VITA le envía un mensaje de texto al
 * contacto de emergencia. Con el dedo se confirma antes de enviar; por voz se envía de una vez
 * ("emergencia médica", "tuve un accidente"), para que sea lo más rápido posible.
 * Si llega con ?tipo=MEDICA&enviar=<marca> (orden de voz desde otra pantalla), envía apenas carga.
 * Si llega con ?preguntar=<marca>[-TIPO] (botón flotante "Pedir ayuda" o escucha de emergencia),
 * pregunta qué pasó, o si ya se sabe el tipo, pregunta "¿Le envío la alerta…?" antes de enviarla.
 * Cada vez que se entra, la pantalla empieza limpia (las pestañas la mantienen viva entre visitas).
 */
export function PantallaEmergencia() {
    const { anunciar, colores } = useAccesibilidad();
    const params = useLocalSearchParams<{ tipo?: TipoEmergencia; enviar?: string; preguntar?: string }>();

    const [contacto, setContacto] = useState<ContactoEmergenciaResponse | null>(null);
    const [cargando, setCargando] = useState(true);
    const [errorCarga, setErrorCarga] = useState<string | null>(null);
    const [ubicacion, setUbicacion] = useState('');
    const [confirmando, setConfirmando] = useState<TipoEmergencia | null>(null);
    const [enviando, setEnviando] = useState<TipoEmergencia | null>(null);
    const [resultado, setResultado] = useState<SolicitudEmergenciaResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [anteriores, setAnteriores] = useState<SolicitudEmergenciaResponse[]>([]);
    const [marcando, setMarcando] = useState<number | null>(null);
    const [avisoExito, setAvisoExito] = useState<string | null>(null);

    // ----- Ubicación ---------------------------------------------------------------------------
    // Al entrar se pide permiso y se busca la ubicación. Si la persona acepta, se envían las
    // coordenadas (el SMS lleva un enlace de Google Maps) y la dirección se escribe sola en
    // "¿Dónde estás?". Si no acepta, se puede escribir a mano o enviar solo con el nombre.
    type EstadoUbicacion = 'buscando' | UbicacionObtenida['estado'] | 'quitada';
    const [estadoUbicacion, setEstadoUbicacion] = useState<EstadoUbicacion>('buscando');
    const [puedePreguntarUbicacion, setPuedePreguntarUbicacion] = useState(true);
    const coordenadasRef = useRef<Coordenadas | null>(null);
    const [coordenadas, setCoordenadas] = useState<Coordenadas | null>(null);
    const busquedaRef = useRef<Promise<void> | null>(null);
    /** Si la persona ya escribió dónde está, la dirección detectada no le borra lo que escribió. */
    const escribioUbicacionRef = useRef(false);

    const enviandoRef = useRef(false);
    /** La última orden de voz ya enviada (para no repetirla al volver a esta pantalla). */
    const ultimaOrdenDeVoz = useRef<string | undefined>(undefined);
    /** La última marca "preguntar" ya respondida (o vista en una visita anterior). */
    const [preguntaAtendida, setPreguntaAtendida] = useState<string | undefined>(undefined);
    const preguntarRef = useRef(params.preguntar);
    preguntarRef.current = params.preguntar;

    const cargar = useCallback(async () => {
        setCargando(true);
        setErrorCarga(null);
        try {
            const [c, lista] = await Promise.all([obtenerContactoEmergencia(), listarEmergencias().catch(() => [])]);
            setContacto(c);
            setAnteriores(lista);
        } catch (e) {
            setErrorCarga(mensajeDeError(e, 'No pudimos cargar tu contacto de emergencia.'));
        } finally {
            setCargando(false);
        }
    }, []);

    const buscarUbicacion = useCallback(() => {
        setEstadoUbicacion('buscando');
        const busqueda = obtenerUbicacionActual().then((u) => {
            if (busquedaRef.current !== busqueda) return; // llegó una búsqueda más nueva
            setEstadoUbicacion(u.estado);
            if (u.estado === 'lista') {
                coordenadasRef.current = u.coordenadas;
                setCoordenadas(u.coordenadas);
                if (u.direccion && !escribioUbicacionRef.current) setUbicacion(u.direccion);
            } else {
                coordenadasRef.current = null;
                setCoordenadas(null);
                if (u.estado === 'sinPermiso') setPuedePreguntarUbicacion(u.puedePreguntarDeNuevo);
            }
        });
        busquedaRef.current = busqueda;
        return busqueda;
    }, []);

    const quitarUbicacion = () => {
        busquedaRef.current = null;
        coordenadasRef.current = null;
        setCoordenadas(null);
        setEstadoUbicacion('quitada');
        anunciar('Listo, no enviaremos tu ubicación exacta.');
    };

    const usarUbicacion = () => {
        // Si el permiso se negó para siempre, solo se puede activar en los ajustes del celular
        if (estadoUbicacion === 'sinPermiso' && !puedePreguntarUbicacion) {
            anunciar('Activa el permiso de ubicación de VITA en los ajustes del celular.');
            abrirAjustesUbicacion();
            return;
        }
        void buscarUbicacion();
    };

    useFocusEffect(
        useCallback(() => {
            // Cada visita empieza limpia: sin el resultado ni la confirmación de la vez anterior
            setResultado(null);
            setConfirmando(null);
            setError(null);
            setUbicacion('');
            escribioUbicacionRef.current = false;
            coordenadasRef.current = null;
            setCoordenadas(null);
            void buscarUbicacion();
            void cargar();
            // Al volver de registrar el contacto, se muestra el "Listo…"
            setAvisoExito(tomarAvisoPendiente());
            return () => {
                // Al salir, la pregunta de esta visita queda atendida (no se repite al volver), y la
                // pantalla se limpia de una vez: así al volver el asistente no lee el resultado anterior
                setPreguntaAtendida(preguntarRef.current);
                setResultado(null);
                setConfirmando(null);
                setError(null);
            };
        }, [cargar, buscarUbicacion]),
    );

    // Se pidió ayuda otra vez estando ya en esta pantalla: empieza limpia
    useEffect(() => {
        if (!params.preguntar) return;
        setResultado(null);
        setConfirmando(null);
        setError(null);
    }, [params.preguntar]);

    /** Tipo de emergencia por el que se pregunta "¿Le envío la alerta…?" (tocado, o dicho al pedir ayuda). */
    const preguntaPendiente = !!params.preguntar && params.preguntar !== preguntaAtendida;
    const tipoPorConfirmar = confirmando ?? (preguntaPendiente ? tipoDeLaPregunta(params.preguntar) : null);

    const cancelarConfirmacion = () => {
        setConfirmando(null);
        setPreguntaAtendida(params.preguntar);
    };

    const nombreContacto = contacto?.nombre ?? 'tu contacto';
    const telefono = telefonoParaMostrar(contacto?.telefono);

    const enviar = async (tipo: TipoEmergencia, lugar = ubicacion) => {
        if (enviandoRef.current) return;
        if (!contacto) {
            const mensaje = `Para pedir ayuda primero registra tu contacto de emergencia. Si es urgente, llama al ${LINEA_EMERGENCIAS}.`;
            setError(mensaje);
            anunciar(mensaje);
            return;
        }
        enviandoRef.current = true;
        setConfirmando(null);
        setPreguntaAtendida(params.preguntar);
        setError(null);
        setEnviando(tipo);
        anunciar(`Enviando alerta de ${nombreTipoEmergencia(tipo).toLowerCase()} a ${contacto.nombre}.`);
        try {
            // Si la ubicación todavía se está buscando, se espera un poco (nunca más de 6 segundos)
            if (busquedaRef.current) {
                await Promise.race([busquedaRef.current, new Promise((r) => setTimeout(r, 6000))]);
            }
            const c = coordenadasRef.current;
            const r = await solicitarEmergencia({
                tipo,
                ubicacion: lugar.trim() || null,
                latitud: c?.latitud ?? null,
                longitud: c?.longitud ?? null,
            });
            setResultado(r);
            setAnteriores((lista) => [r, ...lista.filter((x) => x.id !== r.id)]);
            anunciar(mensajeDelResultado(r));
        } catch (e) {
            const mensaje = mensajeDeError(e, 'No pudimos enviar la alerta.');
            if (/contacto de emergencia/i.test(mensaje)) setContacto(null);
            setError(`${mensaje} Si es urgente, llama al ${LINEA_EMERGENCIAS}.`);
            anunciar(`${mensaje} Si es urgente, llama al ${LINEA_EMERGENCIAS}.`);
        } finally {
            setEnviando(null);
            enviandoRef.current = false;
        }
    };

    // Orden de voz desde otra pantalla ("emergencia médica"): se envía apenas se sepa el contacto
    useEffect(() => {
        if (cargando || !params.enviar || !params.tipo || ultimaOrdenDeVoz.current === params.enviar) return;
        ultimaOrdenDeVoz.current = params.enviar;
        void enviar(params.tipo);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cargando, params.enviar, params.tipo]);

    const marcarAtendida = async (solicitud: SolicitudEmergenciaResponse) => {
        setMarcando(solicitud.id);
        try {
            const r = await marcarEmergenciaAtendida(solicitud.id);
            setAnteriores((lista) => lista.map((x) => (x.id === r.id ? r : x)));
            if (resultado?.id === r.id) setResultado(r);
            anunciar('Listo, marqué la emergencia como atendida. Qué bueno que ya estés bien.');
        } catch (e) {
            const mensaje = mensajeDeError(e, 'No pudimos marcarla como atendida.');
            setError(mensaje);
            anunciar(mensaje);
        } finally {
            setMarcando(null);
        }
    };

    const volver = () => (router.canGoBack() ? router.back() : router.replace('/paciente'));
    const irAContacto = () => router.push('/paciente/contacto-emergencia');

    // ----- Asistente de voz -----------------------------------------------------------------------

    const campoUbicacion: CampoVoz = {
        claves: ['ubicacion', 'mi ubicacion', 'donde estoy', 'direccion', 'lugar', 'estoy en'],
        etiqueta: 'Ubicación',
        pregunta: '¿Dónde estás? Por ejemplo: en mi casa, calle 10 número 5 20.',
        tipo: 'texto',
        valor: ubicacion,
        asignar: (v) => {
            escribioUbicacionRef.current = true;
            setUbicacion(v.charAt(0).toUpperCase() + v.slice(1));
        },
        opcional: true,
    };

    /** Lo que se comparte con el contacto, para el aviso de privacidad. */
    const seCompartira = coordenadas ? 'tu nombre y tu ubicación' : ubicacion.trim() ? 'tu nombre y el lugar que escribiste' : 'tu nombre';

    // "Emergencia médica", "tuve un accidente, estoy en mi casa": se envía de una vez.
    // "Estoy en el parque", "la ubicación es…": se anota dónde está (la ubicación no es un campo del
    // asistente a propósito: así nunca pregunta "¿quieres enviar la alerta?" después de enviarla)
    const dictado = (texto: string, pendiente: string | null): Resultado[] | null => {
        if (pendiente || resultado || enviando || !contacto) return null;
        // Respuesta a "¿Le envío la alerta…?"
        if (tipoPorConfirmar) {
            const respuesta = aPalabras(texto);
            const tipo = tipoPorConfirmar;
            if (SI.test(respuesta)) {
                return [{ tipo: 'accion', indice: -1, accion: { frases: [], ejecutar: () => void enviar(tipo) } }];
            }
            if (NO.test(respuesta)) {
                return [
                    {
                        tipo: 'accion',
                        indice: -1,
                        accion: {
                            frases: [],
                            ejecutar: () => {
                                cancelarConfirmacion();
                                anunciar('Está bien, no envié nada. Si necesitas ayuda, dime: emergencia médica, accidente u otra emergencia, y la enviaré de inmediato.');
                            },
                        },
                    },
                ];
            }
        }
        const lugar = /\b(?:estoy en|mi ubicaci[oó]n es|la ubicaci[oó]n es|ubicaci[oó]n:?)\s+(.+)$/i.exec(texto.trim());
        const tipo = interpretarTipoEmergencia(lugar ? texto.slice(0, lugar.index) : texto);
        const donde = lugar ? lugar[1].trim() : '';
        if (tipo) {
            if (donde) {
                escribioUbicacionRef.current = true;
                setUbicacion(donde.charAt(0).toUpperCase() + donde.slice(1));
            }
            return [{ tipo: 'accion', indice: -1, accion: { frases: [], ejecutar: () => void enviar(tipo, donde || ubicacion) } }];
        }
        if (donde && lugar?.index === 0) return [{ tipo: 'campo', campo: campoUbicacion, valor: donde }];
        return null;
    };

    // Llegó una orden de voz que todavía no se envía (se está cargando el contacto)
    const ordenPendiente = !!params.enviar && !!params.tipo && ultimaOrdenDeVoz.current !== params.enviar;
    const tipoEnCurso = enviando ?? (ordenPendiente ? params.tipo : null);

    useComandosPantalla({
        cargando,
        titulo: 'Pedir ayuda',
        descripcion:
            tipoEnCurso && contacto
                ? `Pedir ayuda. Estoy enviando la alerta de ${nombreTipoEmergencia(tipoEnCurso).toLowerCase()} a ${nombreContacto}.`
                : !contacto
                    ? `Pedir ayuda. Para enviar una alerta primero registra tu contacto de emergencia. Di: registrar contacto, o llamar al ${LINEA_EMERGENCIAS}.`
                    : resultado
                        ? `${mensajeDelResultado(resultado)} Puedes decir: llamar a ${nombreContacto}, llamar al ${LINEA_EMERGENCIAS}, ya me atendieron o volver.`
                        : tipoPorConfirmar
                            ? `Pedir ayuda. Responde sí o no: ¿le envío a ${nombreContacto} la alerta de ${nombreTipoEmergencia(tipoPorConfirmar).toLowerCase()}?`
                            : // Las opciones no van al final: lo último que dice VITA se ignora como eco si se repite enseguida
                            `Pedir ayuda. Dime qué pasó: emergencia médica, accidente u otra emergencia, y enviaré la alerta a ${nombreContacto} de inmediato. Le compartiremos ${seCompartira} por mensaje de texto. ¿Qué pasó?`,
        ejemplos: contacto
            ? ['emergencia médica', 'tuve un accidente, estoy en mi casa', 'otra emergencia', `llamar a ${nombreContacto}`, `llamar al ${LINEA_EMERGENCIAS}`]
            : ['registrar contacto', `llamar al ${LINEA_EMERGENCIAS}`],
        ...(tipoPorConfirmar && contacto && !resultado ? { ejemplos: ['sí', 'no', `llamar a ${nombreContacto}`, `llamar al ${LINEA_EMERGENCIAS}`] } : {}),
        campos: [],
        acciones: [
            ...(contacto && !resultado && !enviando
                ? TIPOS_EMERGENCIA.map((t) => ({
                    frases: [aPalabras(t.titulo), aPalabras(t.titulo.replace(/^Emergencia /, ''))],
                    etiqueta: `enviar alerta de ${t.titulo.toLowerCase()}`,
                    ejecutar: () => void enviar(t.valor),
                }))
                : []),
            ...(contacto
                ? [
                    {
                        frases: [
                            'llamar a mi contacto',
                            'llama a mi contacto',
                            `llamar a ${aPalabras(nombreContacto)}`,
                            `llama a ${aPalabras(nombreContacto)}`,
                        ],
                        etiqueta: `llamar a ${nombreContacto}`,
                        ejecutar: () => llamar(contacto.telefono),
                    },
                ]
                : [
                    {
                        frases: ['registrar contacto', 'agregar contacto', 'registrar mi contacto', 'contacto de emergencia'],
                        etiqueta: 'registrar tu contacto de emergencia',
                        ejecutar: irAContacto,
                    },
                ]),
            {
                frases: [
                    `llamar al ${LINEA_EMERGENCIAS}`,
                    'llamar al uno dos tres',
                    'llamar a emergencias',
                    'llama al 123',
                    'llamar a la linea de emergencias',
                ],
                etiqueta: `llamar al ${LINEA_EMERGENCIAS}`,
                ejecutar: () => llamar(LINEA_EMERGENCIAS),
            },
            ...(resultado?.estado === 'ENVIADA'
                ? [
                    {
                        frases: ['ya me atendieron', 'ya estoy bien', 'marcar como atendida', 'atendida'],
                        etiqueta: 'marcar como atendida',
                        ejecutar: () => void marcarAtendida(resultado),
                    },
                ]
                : []),
            ...(contacto && !resultado && coordenadas
                ? [
                    {
                        frases: ['no enviar mi ubicacion', 'no compartir mi ubicacion', 'sin ubicacion', 'quitar ubicacion', 'no enviar la ubicacion'],
                        etiqueta: 'no enviar tu ubicación exacta',
                        ejecutar: quitarUbicacion,
                    },
                ]
                : []),
            ...(contacto && !resultado && !coordenadas && estadoUbicacion !== 'buscando'
                ? [
                    {
                        frases: ['usar mi ubicacion', 'enviar mi ubicacion', 'compartir mi ubicacion', 'buscar mi ubicacion', 'permitir ubicacion'],
                        etiqueta: 'usar tu ubicación',
                        ejecutar: usarUbicacion,
                    },
                ]
                : []),
            { frases: ['volver', 'atras', 'regresar', 'cancelar'], ejecutar: volver },
            ...accionesComunesVoz('USUARIO', anunciar),
        ],
        dictado,
    }, params.preguntar);

    // ----- Pantalla ---------------------------------------------------------------------------------

    const ultimas = anteriores.slice(0, ANTERIORES);

    return (
        <FondoPantalla>
            <Encabezado
                volver
                alVolver={volver}
                icono="emergencia"
                titulo="Pedir ayuda"
                subtitulo="Le enviaremos un mensaje de texto a tu contacto de emergencia."
            />

            <EstadoCarga cargando={cargando && !contacto} error={errorCarga} reintentar={cargar} hayDatos={!!contacto || !cargando} />

            {error && (
                <View style={styles.aviso}>
                    <Aviso tipo="error" mensaje={error} />
                </View>
            )}
            {avisoExito && !error && !resultado && (
                <View style={styles.aviso}>
                    <Aviso tipo="exito" mensaje={avisoExito} />
                </View>
            )}

            {!cargando && !errorCarga && !contacto && (
                <Tarjeta titulo="Primero, tu contacto de emergencia" icono="contactoEmergencia">
                    <Texto variante="cuerpo" color="textoSecundario">
                        Para pedir ayuda necesitas registrar a la persona que recibirá el mensaje de alerta: un familiar, un amigo o tu cuidador.
                    </Texto>
                    <Boton titulo="Registrar contacto de emergencia" icono="agregar" onPress={irAContacto} />
                    <Boton titulo={`Llamar al ${LINEA_EMERGENCIAS}`} icono="telefono" variante="secundario" onPress={() => llamar(LINEA_EMERGENCIAS)} />
                </Tarjeta>
            )}

            {contacto && resultado && (
                <Tarjeta
                    titulo={resultado.estado === 'FALLIDA' ? 'No se pudo enviar' : 'Alerta enviada'}
                    icono={resultado.estado === 'FALLIDA' ? 'error' : 'check'}
                >
                    <Aviso tipo={resultado.estado === 'FALLIDA' ? 'error' : 'exito'} mensaje={mensajeDelResultado(resultado)} />
                    <View style={styles.botones}>
                        <Boton
                            titulo={`Llamar a ${nombreContacto}`}
                            icono="telefono"
                            variante={resultado.estado === 'FALLIDA' ? 'primario' : 'secundario'}
                            onPress={() => llamar(contacto.telefono)}
                        />
                        <Boton titulo={`Llamar al ${LINEA_EMERGENCIAS}`} icono="telefono" variante="secundario" onPress={() => llamar(LINEA_EMERGENCIAS)} />
                        {resultado.estado === 'ENVIADA' && (
                            <Boton
                                titulo="Ya me atendieron"
                                icono="check"
                                variante="secundario"
                                onPress={() => void marcarAtendida(resultado)}
                                cargando={marcando === resultado.id}
                            />
                        )}
                        <Boton titulo="Volver al inicio" variante="secundario" onPress={() => router.replace('/paciente')} />
                    </View>
                </Tarjeta>
            )}

            {contacto && !resultado && (
                <>
                    <Tarjeta titulo="¿Qué está pasando?" icono="emergencia">
                        <Texto variante="cuerpo" color="textoSecundario">
                            Avisaremos a{' '}
                            <Texto variante="cuerpo" peso="700">
                                {contacto.nombre}
                            </Texto>
                            {contacto.parentesco ? ` (${contacto.parentesco.toLowerCase()})` : ''} al {telefono}.
                        </Texto>
                        <Aviso
                            tipo="info"
                            mensaje={`Al enviar la alerta, ${seCompartira === 'tu nombre' ? 'tu nombre se compartirá' : `${seCompartira} se compartirán`} con ${contacto.nombre} por mensaje de texto.`}
                        />

                        <View style={styles.tipos}>
                            {TIPOS_EMERGENCIA.map((t) => {
                                const elegido = tipoPorConfirmar === t.valor || enviando === t.valor;
                                return (
                                    <View key={t.valor} style={styles.tipoGrupo}>
                                        <Pressable
                                            onPress={() => setConfirmando(t.valor)}
                                            disabled={!!enviando}
                                            accessibilityRole="button"
                                            accessibilityLabel={t.titulo}
                                            accessibilityHint={`${t.descripcion}. Te pediremos confirmar antes de enviar la alerta.`}
                                            style={({ pressed }) => [
                                                styles.tipo,
                                                {
                                                    borderColor: colores.error,
                                                    backgroundColor: elegido ? colores.error : pressed ? colores.errorFondo : colores.superficie,
                                                },
                                            ]}
                                        >
                                            <Icono nombre="emergencia" tamano={28} color={elegido ? colores.sobrePrimario : colores.error} />
                                            <View style={styles.tipoTextos}>
                                                <Texto variante="cuerpo" peso="800" style={{ color: elegido ? colores.sobrePrimario : colores.error }}>
                                                    {t.titulo}
                                                </Texto>
                                                <Texto variante="pequeno" style={{ color: elegido ? colores.sobrePrimario : colores.textoSecundario }}>
                                                    {t.descripcion}
                                                </Texto>
                                            </View>
                                        </Pressable>
                                        {/* Confirmación justo debajo del tipo tocado, para que siempre se vea */}
                                        {elegido && (
                                            <View
                                                style={[styles.confirmacion, { borderColor: colores.error, backgroundColor: colores.errorFondo }]}
                                                accessibilityLiveRegion="polite"
                                            >
                                                <Texto variante="cuerpo" peso="700">
                                                    ¿Enviamos la alerta a {contacto.nombre}?
                                                </Texto>
                                                <Texto variante="pequeno" color="textoSecundario">
                                                    Le llegará un mensaje de texto con tu nombre, avisando que tienes una {t.titulo.toLowerCase()}
                                                    {ubicacion.trim() ? `, que estás en: ${ubicacion.trim()}` : ''}
                                                    {coordenadas ? ' y un enlace para ver tu ubicación en el mapa' : ''}.
                                                </Texto>
                                                <Boton
                                                    titulo="Sí, enviar alerta"
                                                    icono="emergencia"
                                                    variante="peligro"
                                                    onPress={() => void enviar(t.valor)}
                                                    cargando={enviando === t.valor}
                                                />
                                                <Boton
                                                    titulo="No, cancelar"
                                                    variante="secundario"
                                                    onPress={cancelarConfirmacion}
                                                    deshabilitado={!!enviando}
                                                />
                                            </View>
                                        )}
                                    </View>
                                );
                            })}
                        </View>

                        <Campo
                            etiqueta="¿Dónde estás? (opcional)"
                            icono="ubicacion"
                            placeholder="Ej: En mi casa, Calle 10 # 5-20"
                            value={ubicacion}
                            onChangeText={(v) => {
                                escribioUbicacionRef.current = true;
                                setUbicacion(v);
                            }}
                            maxLength={500}
                            ayuda="Se incluye en el mensaje para que sepan dónde encontrarte."
                        />
                        <EstadoDeUbicacion
                            estado={estadoUbicacion}
                            puedePreguntar={puedePreguntarUbicacion}
                            coordenadas={coordenadas}
                            alQuitar={quitarUbicacion}
                            alUsar={usarUbicacion}
                        />
                    </Tarjeta>

                    <Tarjeta titulo="También puedes llamar" icono="telefono">
                        <Boton titulo={`Llamar a ${contacto.nombre}`} icono="telefono" variante="secundario" onPress={() => llamar(contacto.telefono)} />
                        <Boton
                            titulo={`Llamar al ${LINEA_EMERGENCIAS} (emergencias)`}
                            icono="telefono"
                            variante="secundario"
                            onPress={() => llamar(LINEA_EMERGENCIAS)}
                        />
                        <Boton titulo="Cambiar contacto de emergencia" icono="editar" variante="secundario" onPress={irAContacto} />
                    </Tarjeta>
                </>
            )}

            {ultimas.length > 0 && (
                <Tarjeta titulo="Solicitudes anteriores" icono="reloj">
                    <View style={styles.lista}>
                        {ultimas.map((s) => (
                            <ElementoLista
                                key={s.id}
                                titulo={nombreTipoEmergencia(s.tipo)}
                                lineas={[
                                    fechaHoraLarga(s.fechaHora),
                                    ...(s.nombreContacto ? [`Aviso a ${s.nombreContacto}`] : []),
                                    ...(s.ubicacion ? [s.ubicacion] : []),
                                ]}
                                estado={{
                                    texto: nombreEstadoEmergencia(s.estado),
                                    tipo: s.estado === 'FALLIDA' ? 'error' : s.estado === 'ATENDIDA' ? 'exito' : 'info',
                                }}
                                acciones={[
                                    ...(s.estado === 'ENVIADA'
                                        ? [
                                            {
                                                titulo: marcando === s.id ? 'Marcando…' : 'Marcar como atendida',
                                                icono: 'check' as const,
                                                onPress: () => void marcarAtendida(s),
                                                descripcion: `Marcar como atendida la ${nombreTipoEmergencia(s.tipo).toLowerCase()} del ${fechaHoraLarga(s.fechaHora)}`,
                                            },
                                        ]
                                        : []),
                                    ...(s.latitud != null && s.longitud != null
                                        ? [
                                            {
                                                titulo: 'Ver en el mapa',
                                                icono: 'ubicacion' as const,
                                                onPress: () => void Linking.openURL(enlaceMapa({ latitud: s.latitud!, longitud: s.longitud! })),
                                                descripcion: `Ver en el mapa la ubicación enviada el ${fechaHoraLarga(s.fechaHora)}`,
                                            },
                                        ]
                                        : []),
                                ]}
                            />
                        ))}
                    </View>
                </Tarjeta>
            )}
        </FondoPantalla>
    );
}

const styles = StyleSheet.create({
    aviso: {
        marginBottom: Espacio.l,
    },
    tipos: {
        gap: Espacio.m,
    },
    tipo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Espacio.m,
        borderWidth: 2,
        borderRadius: Radio.m,
        padding: Espacio.l,
        minHeight: 72,
    },
    tipoTextos: {
        flex: 1,
        gap: 2,
    },
    tipoGrupo: {
        gap: Espacio.s,
    },
    confirmacion: {
        gap: Espacio.s,
        borderWidth: 1.5,
        borderRadius: Radio.m,
        padding: Espacio.m,
    },
    botones: {
        gap: Espacio.m,
    },
    lista: {
        gap: Espacio.m,
    },
});

/** Debajo de "¿Dónde estás?": si se encontró la ubicación, si se está buscando o por qué no se tiene. */
function EstadoDeUbicacion({
                               estado,
                               puedePreguntar,
                               coordenadas,
                               alQuitar,
                               alUsar,
                           }: {
    estado: 'buscando' | UbicacionObtenida['estado'] | 'quitada';
    puedePreguntar: boolean;
    coordenadas: Coordenadas | null;
    alQuitar: () => void;
    alUsar: () => void;
}) {
    const { colores } = useAccesibilidad();
    const linea = (icono: 'miUbicacion' | 'ubicacion' | 'info', texto: string, color = colores.textoSecundario) => (
        <View style={estilosUbicacion.fila}>
            <Icono nombre={icono} tamano={20} color={color} />
            <Texto variante="pequeno" style={[estilosUbicacion.texto, { color }]}>
                {texto}
            </Texto>
        </View>
    );

    if (estado === 'buscando') return linea('miUbicacion', 'Buscando tu ubicación…');
    if (estado === 'lista' && coordenadas) {
        return (
            <View style={estilosUbicacion.caja}>
                {linea('miUbicacion', 'Ubicación detectada. Tu contacto recibirá un enlace de Google Maps para ver dónde estás.', colores.exito)}
                <Boton titulo="No enviar mi ubicación exacta" variante="secundario" onPress={alQuitar} />
            </View>
        );
    }
    const textos = {
        sinPermiso: 'No diste permiso para usar tu ubicación. Puedes escribir dónde estás o enviar la alerta solo con tu nombre.',
        noDisponible: 'No pudimos obtener tu ubicación (revisa que el GPS esté encendido). Puedes escribir dónde estás.',
        quitada: 'No enviaremos tu ubicación exacta.',
    } as const;
    const texto = textos[estado as keyof typeof textos] ?? textos.noDisponible;
    return (
        <View style={estilosUbicacion.caja}>
            {linea('info', texto)}
            <Boton
                titulo={estado === 'sinPermiso' && !puedePreguntar ? 'Activar ubicación en ajustes' : 'Usar mi ubicación'}
                icono="miUbicacion"
                variante="secundario"
                onPress={alUsar}
            />
        </View>
    );
}

const estilosUbicacion = StyleSheet.create({
    caja: {
        gap: Espacio.s,
    },
    fila: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: Espacio.s,
    },
    texto: {
        flexShrink: 1,
    },
});