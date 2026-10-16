import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Espacio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';
import { useComandosPantalla } from '@/context/asistente-context';
import type { TipoActividad } from '@/dto/TipoActividad';
import type { TipoRecordatorio } from '@/dto/TipoRecordatorio';
import { actualizarActividad, crearActividad, obtenerActividad } from '@/services/actividadSaludService';
import { crearRecordatorio } from '@/services/recordatorioService';
import { aPalabras, type CampoVoz, type Resultado } from '@/utils/comandos-voz';
import { aDia, aFechaHoraLocal, deFechaLocal, horaCorta } from '@/utils/fechas';
import { dejarAvisoPendiente } from '@/utils/fuente-sintomas';
import { mensajeDeError } from '@/utils/sesion';
import {
    aTextoFecha,
    diaLargo,
    interpretarFecha,
    interpretarHora,
    nombreDiaRelativo,
    separarFechaHora,
    sinPuntoDoble,
    TIPOS_ACTIVIDAD,
    TIPOS_AVISO,
    unirFechaHora,
} from '@/utils/salud';
import { campoDelError } from '@/utils/textos';
import { EJEMPLO_HORA } from '@/utils/validaciones';

import { accionesComunesVoz } from './acciones-cuenta';
import { Aviso } from './aviso';
import { Boton } from './boton';
import { CampoHora } from './campo-hora';
import { Campo, NotaCamposObligatorios } from './campo';
import { ControlSegmentado } from './control-segmentado';
import { Encabezado } from './encabezado';
import { EstadoCarga } from './estado-carga';
import { FondoPantalla } from './fondo-pantalla';
import { OpcionesFiltro } from './opciones-filtro';
import { Tarjeta } from './tarjeta';
import { Texto } from './texto';

type Errores = Partial<Record<'nombre' | 'tipo' | 'fecha' | 'hora' | 'ubicacion' | 'descripcion' | 'recordatorio', string>>;

/** Cuánto antes de la actividad llega el recordatorio (en minutos). "" = sin recordatorio. */
const RECORDATORIOS = [
    { valor: '', titulo: 'Sin recordatorio' },
    { valor: '30', titulo: '30 minutos antes' },
    { valor: '60', titulo: '1 hora antes' },
    { valor: '1440', titulo: '1 día antes' },
];

/** "una hora antes", "un día antes", "media hora antes", "no" → minutos. */
function interpretarRecordatorio(texto: string): string | null {
    const t = aPalabras(texto);
    if (/^(no|ninguno|sin recordatorio|no quiero)$/.test(t)) return '';
    if (/(media hora|30 minutos|treinta minutos)/.test(t)) return '30';
    if (/(una hora|1 hora)/.test(t)) return '60';
    if (/(un dia|1 dia|el dia antes|dia antes)/.test(t)) return '1440';
    return null;
}

const OPCIONES_FECHA = () => {
    const hoy = new Date();
    const manana = new Date(hoy);
    manana.setDate(hoy.getDate() + 1);
    const pasado = new Date(hoy);
    pasado.setDate(hoy.getDate() + 2);
    return [
        { valor: aDia(hoy), titulo: 'Hoy' },
        { valor: aDia(manana), titulo: 'Mañana' },
        { valor: aDia(pasado), titulo: 'Pasado mañana' },
    ];
};

/**
 * Crear o editar una actividad de salud (cita médica, terapia u otra).
 * Obligatorios: nombre, tipo, fecha y hora (en el futuro, como exige el backend).
 * Al crearla se puede programar de una vez un recordatorio (30 minutos, 1 hora o 1 día antes).
 * Por voz: "control con medicina general mañana a las 9 en el hospital San Juan".
 */
export function FormularioActividad({ id }: { id?: number }) {
    const editando = id !== undefined;
    const { anunciar } = useAccesibilidad();
    const inicial = useLocalSearchParams<{ fecha?: string; tipo?: string; dictado?: string }>();

    const [nombre, setNombre] = useState('');
    const [tipo, setTipo] = useState<TipoActividad | ''>((inicial.tipo as TipoActividad) ?? '');
    const [fecha, setFecha] = useState<Date | null>(() => (inicial.fecha && !editando ? deFechaLocal(inicial.fecha) : null));
    const [textoFecha, setTextoFecha] = useState('');
    const [textoHora, setTextoHora] = useState('');
    const [ubicacion, setUbicacion] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [recordatorio, setRecordatorio] = useState('');
    const [tipoAviso, setTipoAviso] = useState<TipoRecordatorio>('VOCAL');

    const [cargandoDatos, setCargandoDatos] = useState(editando);
    const [errorCarga, setErrorCarga] = useState<string | null>(null);
    const [errores, setErrores] = useState<Errores>({});
    const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
    const [guardando, setGuardando] = useState(false);

    const quitarError = (campo: keyof Errores) => setErrores((e) => (e[campo] ? { ...e, [campo]: undefined } : e));

    /** Llena lo que se entienda de una frase: "mañana a las 9 en el hospital San Juan". */
    const aplicarFrase = (frase: string) => {
        let resto = frase.trim();
        const lugar = /\s+en\s+(?:el |la |los |las )?(.+)$/i.exec(resto);
        if (lugar) {
            setUbicacion(lugar[1].charAt(0).toUpperCase() + lugar[1].slice(1));
            resto = resto.slice(0, lugar.index);
        }
        const { fecha: f, hora: h } = separarFechaHora(resto);
        if (f) {
            setFecha(f);
            setTextoFecha('');
        }
        if (h) setTextoHora(horaCorta(unirFechaHora(new Date(), h)));
        return !!(f || h || lugar);
    };

    // Al llegar por voz desde la agenda ("nueva cita mañana a las 9 en el hospital")
    useEffect(() => {
        if (!editando && inicial.dictado) aplicarFrase(inicial.dictado);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const cargar = async () => {
        if (id === undefined) return;
        setCargandoDatos(true);
        setErrorCarga(null);
        try {
            const a = await obtenerActividad(id);
            const cuando = deFechaLocal(a.fechaHora);
            setNombre(a.nombre);
            setTipo(a.tipo);
            setFecha(new Date(cuando.getFullYear(), cuando.getMonth(), cuando.getDate()));
            setTextoHora(horaCorta(cuando));
            setUbicacion(a.ubicacion ?? '');
            setDescripcion(a.descripcion ?? '');
        } catch (e) {
            setErrorCarga(mensajeDeError(e, 'No pudimos cargar la actividad.'));
        } finally {
            setCargandoDatos(false);
        }
    };

    useEffect(() => {
        void cargar();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    // Fecha elegida: con un botón (Hoy, Mañana…) o escrita en "Otra fecha"
    const fechaEscrita = textoFecha.trim() ? interpretarFecha(textoFecha) : null;
    const fechaFinal = textoFecha.trim() ? fechaEscrita : fecha;
    const hora = textoHora.trim() ? interpretarHora(textoHora) : null;
    const cuando = fechaFinal && hora ? unirFechaHora(fechaFinal, hora) : null;
    // Solo se ofrecen los recordatorios que todavía quedarían en el futuro (por ejemplo, "1 día antes" no sirve para una cita de hoy)
    const opcionesRecordatorio = cuando ? RECORDATORIOS.filter((r) => !r.valor || cuando.getTime() - Number(r.valor) * 60_000 > Date.now()) : RECORDATORIOS;
    const opcionesFecha = OPCIONES_FECHA();
    const opcionFecha = !textoFecha.trim() && fecha ? (opcionesFecha.find((o) => o.valor === aDia(fecha))?.valor ?? '') : '';

    const validar = (): Errores => {
        const e: Errores = {};
        if (!nombre.trim()) e.nombre = 'Escribe el nombre de la actividad';
        else if (nombre.trim().length > 150) e.nombre = 'El nombre no puede superar 150 caracteres';
        if (!tipo) e.tipo = 'Elige el tipo de actividad';
        if (!fechaFinal) e.fecha = textoFecha.trim() ? 'No entendí la fecha. Escribe, por ejemplo: 20/10/2026, el viernes o 20 de octubre' : 'Elige la fecha';
        if (!textoHora.trim()) e.hora = 'Escribe la hora';
        else if (!hora) e.hora = `La hora no es válida. ${EJEMPLO_HORA}`;
        if (cuando && cuando.getTime() <= Date.now()) e.hora = 'La fecha y hora de la actividad deben ser futuras';
        if (ubicacion.trim().length > 255) e.ubicacion = 'La ubicación no puede superar 255 caracteres';
        if (descripcion.trim().length > 255) e.descripcion = 'La descripción no puede superar 255 caracteres';
        if (!editando && recordatorio && cuando && cuando.getTime() - Number(recordatorio) * 60000 <= Date.now()) {
            e.recordatorio = 'Ese recordatorio quedaría en el pasado. Elige uno más cercano a la actividad.';
        }
        return e;
    };

    const volver = () => (router.canGoBack() ? router.back() : router.replace('/paciente/salud/agenda'));

    const guardar = async () => {
        const encontrados = validar();
        setErrores(encontrados);
        setErrorGeneral(null);
        if (Object.keys(encontrados).length > 0 || !cuando || !tipo) {
            anunciar(`Revisa el formulario. ${Object.values(encontrados).join('. ')}`);
            return;
        }
        const datos = {
            nombre: nombre.trim(),
            tipo,
            fechaHora: aFechaHoraLocal(cuando),
            ubicacion: ubicacion.trim() || null,
            descripcion: descripcion.trim() || null,
        };
        setGuardando(true);
        try {
            const guardada = id !== undefined ? await actualizarActividad(id, datos) : await crearActividad(datos);
            let mensaje = editando
                ? `Listo, guardé los cambios de ${guardada.nombre}.`
                : `Listo, agendé ${guardada.nombre} para ${nombreDiaRelativo(cuando).toLowerCase()} a las ${horaCorta(cuando)}.`;
            if (!editando && recordatorio) {
                try {
                    await crearRecordatorio(guardada.id, {
                        fechaHora: aFechaHoraLocal(new Date(cuando.getTime() - Number(recordatorio) * 60000)),
                        mensaje: `${guardada.nombre} a las ${horaCorta(cuando)}${guardada.ubicacion ? `, en ${guardada.ubicacion}` : ''}`,
                        tipoRecordatorio: tipoAviso,
                    });
                    mensaje += ` Te lo recordaré ${RECORDATORIOS.find((r) => r.valor === recordatorio)?.titulo.toLowerCase()}.`;
                } catch (e) {
                    mensaje += ` Pero no pude crear el recordatorio: ${mensajeDeError(e, 'inténtalo desde el detalle de la actividad')}`;
                }
            }
            mensaje = sinPuntoDoble(mensaje);
            anunciar(mensaje);
            dejarAvisoPendiente(mensaje);
            router.dismissTo({ pathname: '/paciente/salud/agenda', params: { dia: aDia(cuando) } });
        } catch (e) {
            const mensaje = mensajeDeError(e, 'No pudimos guardar la actividad.');
            const campo = campoDelError<keyof Errores>(mensaje, [
                [/nombre/i, 'nombre'],
                [/tipo/i, 'tipo'],
                [/fecha|hora|futur/i, 'hora'],
                [/ubicaci/i, 'ubicacion'],
                [/descripci/i, 'descripcion'],
            ]);
            if (campo) setErrores({ [campo]: mensaje });
            else setErrorGeneral(mensaje);
            anunciar(mensaje);
        } finally {
            setGuardando(false);
        }
    };

    // ----- Asistente de voz -----------------------------------------------------------------------

    const campoNombre: CampoVoz = {
        claves: ['nombre', 'se llama', 'titulo', 'la actividad', 'la cita'],
        etiqueta: 'Nombre',
        pregunta: '¿Cómo se llama la actividad? Por ejemplo: control con medicina general.',
        tipo: 'texto',
        valor: nombre,
        asignar: (v) => {
            setNombre(v.charAt(0).toUpperCase() + v.slice(1));
            quitarError('nombre');
        },
    };
    const campoTipo: CampoVoz = {
        claves: ['tipo', 'es una', 'es un'],
        etiqueta: 'Tipo',
        pregunta: '¿Es una cita médica, una terapia u otra actividad?',
        tipo: 'texto',
        valor: tipo ? (TIPOS_ACTIVIDAD.find((t) => t.valor === tipo)?.titulo ?? '') : '',
        asignar: (v) => {
            const t = aPalabras(v);
            const elegido = /terapia/.test(t) ? 'TERAPIA' : /cita|medic|control/.test(t) ? 'CITA_MEDICA' : /otr/.test(t) ? 'OTRO' : null;
            if (elegido) {
                setTipo(elegido);
                quitarError('tipo');
            } else setErrores((e) => ({ ...e, tipo: 'Di: cita médica, terapia u otra' }));
        },
    };
    const campoFecha: CampoVoz = {
        claves: ['fecha', 'el dia', 'dia', 'cuando'],
        etiqueta: 'Fecha',
        pregunta: '¿Qué día es? Por ejemplo: mañana, el viernes o el 20 de octubre.',
        tipo: 'texto',
        valor: fechaFinal ? diaLargo(fechaFinal) : '',
        asignar: (v) => {
            const { fecha: f, hora: h } = separarFechaHora(v);
            if (f) {
                setFecha(f);
                setTextoFecha('');
                quitarError('fecha');
            } else setTextoFecha(v);
            if (h) setTextoHora(horaCorta(unirFechaHora(new Date(), h)));
        },
    };
    const campoHora: CampoVoz = {
        claves: ['hora', 'a que hora', 'a las'],
        etiqueta: 'Hora',
        pregunta: '¿A qué hora? Por ejemplo: a las 9 y media de la mañana.',
        tipo: 'texto',
        valor: textoHora,
        asignar: (v) => {
            const h = interpretarHora(v);
            // Si lo dictado no es una hora, el campo queda vacío para que VITA la vuelva a preguntar
            setTextoHora(h ? horaCorta(unirFechaHora(new Date(), h)) : '');
            if (h) quitarError('hora');
            else setErrores((e) => ({ ...e, hora: `La hora no es válida. ${EJEMPLO_HORA}` }));
        },
    };
    const campoLugar: CampoVoz = {
        claves: ['lugar', 'ubicacion', 'donde', 'direccion', 'sitio'],
        etiqueta: 'Lugar',
        pregunta: '¿Dónde es? Por ejemplo: Hospital San Juan.',
        tipo: 'texto',
        valor: ubicacion,
        asignar: (v) => setUbicacion(/^(no|ninguno|nada)$/.test(aPalabras(v)) ? '' : v.charAt(0).toUpperCase() + v.slice(1)),
        opcional: true,
    };
    const campoDescripcion: CampoVoz = {
        claves: ['descripcion', 'nota', 'notas', 'detalles', 'observaciones'],
        etiqueta: 'Descripción',
        pregunta: '¿Qué nota quieres agregar? Por ejemplo: llevar exámenes.',
        tipo: 'texto',
        valor: descripcion,
        asignar: (v) => setDescripcion(/^(no|ninguna|nada)$/.test(aPalabras(v)) ? '' : v),
        opcional: true,
    };
    const campoRecordatorio: CampoVoz = {
        claves: ['recordatorio', 'recuerdame', 'avisame', 'aviso'],
        etiqueta: 'Recordatorio',
        pregunta: '¿Cuándo te lo recuerdo? Puedes decir: 30 minutos antes, una hora antes o un día antes.',
        tipo: 'texto',
        valor: RECORDATORIOS.find((r) => r.valor === recordatorio && r.valor)?.titulo ?? '',
        asignar: (v) => {
            const r = interpretarRecordatorio(v);
            if (r !== null) {
                setRecordatorio(r);
                quitarError('recordatorio');
            } else setErrores((e) => ({ ...e, recordatorio: 'Di: 30 minutos antes, una hora antes o un día antes' }));
        },
        opcional: true,
    };
    const campos = [campoNombre, campoTipo, campoFecha, campoHora, campoLugar, campoDescripcion, ...(editando ? [] : [campoRecordatorio])];

    const dictado = (texto: string, pendiente: string | null): Resultado[] | null => {
        if (pendiente) return null;
        const t = aPalabras(texto);
        // "Recuérdamelo una hora antes"
        if (!editando && /^(recuerdame|recuerdamelo|avisame|me avisas)/.test(t)) {
            return [{ tipo: 'campo', campo: campoRecordatorio, valor: texto }];
        }
        // "Mañana a las 9 en el hospital", "el viernes a las 3"
        const { fecha: f, hora: h } = separarFechaHora(texto.replace(/\s+en\s+.+$/i, ''));
        if (f || (h && /\ba las?\b/.test(t))) {
            return [{ tipo: 'accion', indice: -1, accion: { frases: [], ejecutar: () => void aplicarFrase(texto) } }];
        }
        return null;
    };

    const titulo = editando ? 'Editar actividad' : 'Nueva actividad';

    useComandosPantalla({
        titulo,
        descripcion: editando
            ? 'Editar actividad. Dime qué quieres cambiar, por ejemplo: la hora es 10 de la mañana, y luego di: guardar.'
            : 'Nueva actividad. Dime el nombre, el tipo, el día y la hora. Por ejemplo: control con medicina general, cita médica, mañana a las 9.',
        ejemplos: ['el nombre es control con medicina general', 'cita médica', 'mañana a las 9', 'el lugar es hospital San Juan', 'recuérdamelo una hora antes', 'guardar'],
        campos: editando && cargandoDatos ? [] : campos,
        pasosOpcionales: editando
            ? []
            : [{ pregunta: 'Responde sí o no: ¿quieres agregar el lugar, una nota o un recordatorio?', campos: ['Lugar', 'Descripción', 'Recordatorio'] }],
        acciones: [
            {
                frases: ['guardar', 'guarda', 'guardalo', 'agendar', 'agendala', 'listo', 'terminar', 'guardar cambios'],
                etiqueta: editando ? 'guardar los cambios' : 'guardar la actividad',
                ejecutar: () => void guardar(),
            },
            { frases: ['cita medica', 'es una cita'], ejecutar: () => campoTipo.asignar('cita') },
            { frases: ['terapia', 'es una terapia'], ejecutar: () => campoTipo.asignar('terapia') },
            { frases: ['volver', 'atras', 'regresar', 'cancelar', 'no guardar'], ejecutar: volver },
            ...accionesComunesVoz('USUARIO', anunciar),
        ],
        dictado,
    });

    // ----- Pantalla -----------------------------------------------------------------------------------

    const ayudaFecha = textoFecha.trim()
        ? fechaEscrita
            ? `Se guardará: ${diaLargo(fechaEscrita)}`
            : undefined
        : fecha
          ? `Día elegido: ${diaLargo(fecha)}`
          : 'Elige un día o escríbelo.';
    const ayudaHora = hora && fechaFinal ? `Se guardará: ${nombreDiaRelativo(fechaFinal).toLowerCase()} a las ${horaCorta(unirFechaHora(fechaFinal, hora))}` : undefined;

    return (
        <FondoPantalla>
            <Encabezado volver alVolver={volver} icono="calendario" titulo={titulo} subtitulo="Citas, terapias y otras actividades de salud" />

            {editando && cargandoDatos ? (
                <EstadoCarga cargando={cargandoDatos} error={errorCarga} reintentar={cargar} hayDatos={false} />
            ) : (
                <>
                    <Tarjeta titulo="Actividad" icono="calendario">
                        <Campo
                            etiqueta="Nombre"
                            icono="nota"
                            placeholder="Ej: Control con medicina general"
                            value={nombre}
                            onChangeText={(v) => {
                                setNombre(v);
                                quitarError('nombre');
                            }}
                            error={errores.nombre}
                            maxLength={150}
                            autoCapitalize="sentences"
                            obligatorio
                        />
                        <View style={styles.grupo}>
                            <Texto variante="etiqueta">
                                Tipo
                                <Texto variante="etiqueta" color="error">
                                    {' *'}
                                </Texto>
                            </Texto>
                            <OpcionesFiltro
                                etiqueta="Tipo"
                                opciones={TIPOS_ACTIVIDAD}
                                valor={tipo as TipoActividad}
                                onCambiar={(v) => {
                                    setTipo(v);
                                    quitarError('tipo');
                                }}
                            />
                            {errores.tipo ? (
                                <Texto variante="pequeno" color="error" peso="600">
                                    {errores.tipo}
                                </Texto>
                            ) : null}
                        </View>
                    </Tarjeta>

                    <Tarjeta titulo="Fecha y hora" icono="reloj">
                        <View style={styles.grupo}>
                            <Texto variante="etiqueta">
                                Fecha
                                <Texto variante="etiqueta" color="error">
                                    {' *'}
                                </Texto>
                            </Texto>
                            <OpcionesFiltro
                                etiqueta="Fecha"
                                opciones={opcionesFecha}
                                valor={opcionFecha}
                                onCambiar={(v) => {
                                    setFecha(deFechaLocal(v));
                                    setTextoFecha('');
                                    quitarError('fecha');
                                }}
                            />
                        </View>
                        <Campo
                            etiqueta="Otra fecha"
                            icono="calendario"
                            placeholder={fecha ? aTextoFecha(fecha) : 'Ej: 20/10/2026 o el viernes'}
                            value={textoFecha}
                            onChangeText={(v) => {
                                setTextoFecha(v);
                                quitarError('fecha');
                            }}
                            error={errores.fecha}
                            ayuda={ayudaFecha}
                        />
                        <CampoHora
                            etiqueta="Hora"
                            placeholder="Ej: 9:30 a. m."
                            valor={textoHora}
                            onCambiar={setTextoHora}
                            onError={(e) => setErrores((x) => ({ ...x, hora: e }))}
                            error={errores.hora}
                            ayuda={ayudaHora}
                            obligatorio
                        />
                    </Tarjeta>

                    <Tarjeta titulo="Detalles adicionales" icono="ubicacion">
                        <Campo
                            etiqueta="Lugar"
                            icono="ubicacion"
                            placeholder="Ej: Hospital San Juan"
                            value={ubicacion}
                            onChangeText={(v) => {
                                setUbicacion(v);
                                quitarError('ubicacion');
                            }}
                            error={errores.ubicacion}
                            maxLength={255}
                        />
                        <Campo
                            etiqueta="Descripción"
                            icono="nota"
                            placeholder="Ej: Llevar los exámenes de sangre"
                            value={descripcion}
                            onChangeText={(v) => {
                                setDescripcion(v);
                                quitarError('descripcion');
                            }}
                            error={errores.descripcion}
                            maxLength={255}
                            multiline
                        />
                    </Tarjeta>

                    {!editando && (
                        <Tarjeta titulo="Recordatorio" icono="campana">
                            <OpcionesFiltro
                                etiqueta="Recordatorio"
                                opciones={opcionesRecordatorio}
                                valor={opcionesRecordatorio.some((r) => r.valor === recordatorio) ? recordatorio : ''}
                                onCambiar={(v) => {
                                    setRecordatorio(v);
                                    quitarError('recordatorio');
                                }}
                            />
                            {recordatorio ? (
                                <View style={styles.grupo}>
                                    <Texto variante="etiqueta">Tipo de aviso</Texto>
                                    <ControlSegmentado etiqueta="Tipo de aviso" opciones={TIPOS_AVISO} valor={tipoAviso} onCambiar={setTipoAviso} />
                                </View>
                            ) : null}
                            {errores.recordatorio ? (
                                <Texto variante="pequeno" color="error" peso="600">
                                    {errores.recordatorio}
                                </Texto>
                            ) : null}
                        </Tarjeta>
                    )}

                    <View style={styles.botones}>
                        <NotaCamposObligatorios />
                        <Boton titulo={editando ? 'Guardar cambios' : 'Guardar actividad'} icono="check" onPress={guardar} cargando={guardando} />
                        {errorGeneral && <Aviso mensaje={errorGeneral} />}
                        <Boton titulo="Cancelar" variante="secundario" onPress={volver} />
                    </View>
                </>
            )}
        </FondoPantalla>
    );
}

const styles = StyleSheet.create({
    grupo: {
        gap: Espacio.s,
    },
    botones: {
        gap: Espacio.m,
        marginBottom: Espacio.xl,
    },
});
