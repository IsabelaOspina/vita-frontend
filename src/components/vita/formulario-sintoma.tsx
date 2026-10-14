import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';

import { Espacio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';
import { useComandosPantalla } from '@/context/asistente-context';
import type { SintomaResponse } from '@/dto/SintomaResponse';
import { actualizarSintoma, obtenerSintoma, obtenerTiposSintoma, registrarSintoma } from '@/services/sintomaService';
import { aPalabras, type CampoVoz, type Resultado } from '@/utils/comandos-voz';
import { aFechaHoraLocal, aTextoCampo, deFechaLocal, fechaHoraLarga, interpretarCuando } from '@/utils/fechas';
import { mensajeDeError } from '@/utils/sesion';
import { numeroIntensidad, separarSintoma, SINTOMAS_COMUNES } from '@/utils/sintomas';
import { campoDelError } from '@/utils/textos';

import { accionesComunesVoz } from './acciones-cuenta';
import { Aviso } from './aviso';
import { Boton } from './boton';
import { Campo } from './campo';
import { Encabezado } from './encabezado';
import { EstadoCarga } from './estado-carga';
import { FondoPantalla } from './fondo-pantalla';
import { OpcionesFiltro } from './opciones-filtro';
import { SelectorIntensidad } from './selector-intensidad';
import { Tarjeta } from './tarjeta';
import { Texto } from './texto';

type Errores = Partial<Record<'tipo' | 'intensidad' | 'cuando' | 'observaciones', string>>;

/** Tolerancia del backend por si el reloj del celular va adelantado. */
const TOLERANCIA_FUTURO_MS = 5 * 60 * 1000;

/** Respuestas que significan "no quiero agregar observaciones". */
const SIN_OBSERVACIONES = /^(no|ninguna|ninguno|nada|no gracias|no tengo)$/;

/** "dolor de cabeza" → "Dolor de cabeza". */
const capitalizar = (texto: string) => {
    const limpio = texto.trim().replace(/\s+/g, ' ');
    return limpio.charAt(0).toUpperCase() + limpio.slice(1);
};

/** Mismas reglas que SintomaRequest en el backend. */
function validar(d: { tipo: string; intensidad: number | null; cuando: string; observaciones: string }): Errores {
    const errores: Errores = {};
    if (!d.tipo.trim()) errores.tipo = 'Escribe qué síntoma tienes';
    else if (d.tipo.trim().length > 100) errores.tipo = 'El síntoma admite máximo 100 caracteres';
    if (d.intensidad === null) errores.intensidad = 'Elige la intensidad, del 1 al 10';
    if (d.cuando.trim()) {
        const fecha = interpretarCuando(d.cuando);
        if (!fecha) errores.cuando = 'No entendí la fecha. Escribe, por ejemplo: hace 2 horas, ayer a las 8 pm o 14/10/2026 09:30';
        else if (fecha.getTime() > Date.now() + TOLERANCIA_FUTURO_MS) errores.cuando = 'La fecha y hora del síntoma no puede estar en el futuro';
    }
    if (d.observaciones.trim().length > 1000) errores.observaciones = 'Las observaciones admiten máximo 1000 caracteres';
    return errores;
}

type Props = {
    /** Id del síntoma a editar. Sin id, se registra uno nuevo. */
    id?: number;
};

/**
 * Registrar o editar un síntoma (paciente). Obligatorios: qué síntoma y su intensidad.
 * Cuándo y las observaciones son opcionales: si no se dice cuándo, se guarda con la hora actual.
 *
 * Por voz se puede decir todo junto: "tengo dolor de cabeza intensidad 7 hace dos horas".
 * Al abrirlo desde la lista con esa frase, llega ya lleno (parámetros tipo, intensidad y cuando).
 */
export function FormularioSintoma({ id }: Props) {
    const editando = id !== undefined;
    const { anunciar } = useAccesibilidad();
    const inicial = useLocalSearchParams<{ tipo?: string; intensidad?: string; cuando?: string }>();

    const [tipo, setTipo] = useState(editando ? '' : (inicial.tipo ?? ''));
    const [intensidad, setIntensidad] = useState<number | null>(
        !editando && inicial.intensidad ? numeroIntensidad(inicial.intensidad) : null,
    );
    const [cuando, setCuando] = useState(editando ? '' : (inicial.cuando ?? ''));
    const [observaciones, setObservaciones] = useState('');
    const [sugerencias, setSugerencias] = useState<string[]>(SINTOMAS_COMUNES);

    /** Al editar: el síntoma como estaba y su fecha como se muestra en el campo. */
    const [original, setOriginal] = useState<SintomaResponse | null>(null);
    const [cuandoOriginal, setCuandoOriginal] = useState('');
    const [cargandoDatos, setCargandoDatos] = useState(editando);
    const [errorCarga, setErrorCarga] = useState<string | null>(null);

    const [errores, setErrores] = useState<Errores>({});
    const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
    const [guardando, setGuardando] = useState(false);

    const observacionesRef = useRef<TextInput>(null);

    // Los tipos que ya registró se sugieren primero (y se completan con los más comunes)
    useEffect(() => {
        obtenerTiposSintoma()
            .then((tipos) => {
                const propios = tipos.map((t) => t.tipo);
                const comunes = SINTOMAS_COMUNES.filter((c) => !propios.some((p) => aPalabras(p) === aPalabras(c)));
                setSugerencias([...propios, ...comunes].slice(0, 6));
            })
            .catch(() => {
                // Sin sugerencias propias se dejan las comunes
            });
    }, []);

    const cargar = async () => {
        if (id === undefined) return;
        setCargandoDatos(true);
        setErrorCarga(null);
        try {
            const sintoma = await obtenerSintoma(id);
            const texto = aTextoCampo(deFechaLocal(sintoma.fechaHora));
            setOriginal(sintoma);
            setTipo(sintoma.tipo);
            setIntensidad(sintoma.intensidad);
            setCuando(texto);
            setCuandoOriginal(texto);
            setObservaciones(sintoma.observaciones ?? '');
        } catch (e) {
            setErrorCarga(mensajeDeError(e, 'No pudimos cargar el síntoma.'));
        } finally {
            setCargandoDatos(false);
        }
    };

    useEffect(() => {
        void cargar();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    /** Al corregir un campo se quita su error. */
    const cambiar = (campo: keyof Errores, asignar: (valor: string) => void) => (valor: string) => {
        asignar(valor);
        setErrores((e) => (e[campo] ? { ...e, [campo]: undefined } : e));
    };
    const cambiarTipo = cambiar('tipo', setTipo);
    const cambiarCuando = cambiar('cuando', setCuando);
    const cambiarObservaciones = cambiar('observaciones', setObservaciones);

    const volver = () => (router.canGoBack() ? router.back() : router.replace('/paciente/sintomas'));

    // Lo que se muestra debajo de "¿Cuándo?": cómo se va a guardar
    const fechaEntendida = cuando.trim() ? interpretarCuando(cuando) : null;
    const ayudaCuando = !cuando.trim()
        ? 'Si lo dejas vacío, se guarda con la hora de ahora.'
        : fechaEntendida
            ? `Se guardará: ${fechaHoraLarga(aFechaHoraLocal(fechaEntendida))}`
            : undefined;

    const guardar = async () => {
        const encontrados = validar({ tipo, intensidad, cuando, observaciones });
        setErrores(encontrados);
        setErrorGeneral(null);
        if (Object.keys(encontrados).length > 0 || intensidad === null) {
            anunciar(`Revisa el formulario. ${Object.values(encontrados).join('. ')}`);
            return;
        }

        // Al editar, la fecha solo se envía si cambió (si no, el backend conserva la que tenía)
        const cambioCuando = editando ? cuando.trim() !== cuandoOriginal : !!cuando.trim();
        const fecha = cambioCuando ? interpretarCuando(cuando) : null;
        const datos = {
            tipo: capitalizar(tipo),
            intensidad,
            fechaHora: fecha ? aFechaHoraLocal(fecha) : undefined,
            observaciones: observaciones.trim() || undefined,
        };

        setGuardando(true);
        try {
            const guardado = id !== undefined ? await actualizarSintoma(id, datos) : await registrarSintoma(datos);
            const mensaje = editando
                ? `Listo, guardé los cambios de ${guardado.tipo.toLowerCase()}.`
                : `Listo, guardé ${guardado.tipo.toLowerCase()} con intensidad ${guardado.intensidad} de 10.`;
            anunciar(mensaje);
            // Vuelve a la lista (que muestra el aviso y ya trae el síntoma nuevo o editado)
            router.dismissTo({ pathname: '/paciente/sintomas', params: { aviso: mensaje } });
        } catch (e) {
            const mensaje = mensajeDeError(e, 'No pudimos guardar el síntoma.');
            // El error va debajo del campo que lo causó; si no es de un campo, debajo del botón
            const campo = campoDelError<keyof Errores>(mensaje, [
                [/tipo|s[ií]ntoma es obligatorio/i, 'tipo'],
                [/intensidad/i, 'intensidad'],
                [/fecha|hora|futuro/i, 'cuando'],
                [/observaci/i, 'observaciones'],
            ]);
            if (campo) setErrores({ [campo]: mensaje });
            else setErrorGeneral(mensaje);
            anunciar(mensaje);
        } finally {
            setGuardando(false);
        }
    };

    // ----- Asistente de voz ----------------------------------------------------------------------

    const campoTipo: CampoVoz = {
        claves: ['tipo de sintoma', 'el sintoma', 'sintoma', 'que siento', 'que sientes', 'tipo'],
        etiqueta: 'Síntoma',
        pregunta: '¿Qué síntoma tienes? Por ejemplo: dolor de cabeza, mareo o náuseas.',
        tipo: 'texto',
        valor: tipo,
        asignar: (valor) => setTipo(capitalizar(valor)),
    };
    const campoIntensidad: CampoVoz = {
        claves: ['intensidad', 'nivel', 'que tan fuerte', 'fuerza'],
        etiqueta: 'Intensidad',
        pregunta: '¿Qué tan fuerte es, del 1 al 10? 1 es muy leve y 10 es insoportable.',
        tipo: 'texto',
        valor: intensidad === null ? '' : String(intensidad),
        asignar: (valor) => {
            const numero = numeroIntensidad(valor);
            if (numero !== null) {
                setIntensidad(numero);
                setErrores((e) => ({ ...e, intensidad: undefined }));
            } else {
                setErrores((e) => ({ ...e, intensidad: 'La intensidad debe ser un número del 1 al 10' }));
            }
        },
    };
    const campoCuando: CampoVoz = {
        claves: ['fecha y hora', 'cuando', 'fecha', 'hora', 'empezo', 'fue'],
        etiqueta: 'Cuándo',
        pregunta: '¿Cuándo lo sentiste? Por ejemplo: hace dos horas, o ayer a las 8 de la noche. Si fue ahora, di: ahora.',
        tipo: 'texto',
        valor: cuando,
        // En un síntoma nuevo, "ahora" es dejarlo vacío (el backend usa la hora actual)
        asignar: (valor) => setCuando(!editando && /^(ahora|ahorita|ya)$/i.test(valor.trim()) ? '' : valor.toLowerCase()),
        opcional: true,
    };
    const campoObservaciones: CampoVoz = {
        claves: ['observaciones', 'observacion', 'notas', 'nota', 'comentario', 'detalles'],
        etiqueta: 'Observaciones',
        pregunta: '¿Qué observación quieres agregar? Por ejemplo: empezó después del almuerzo.',
        tipo: 'texto',
        valor: observaciones,
        asignar: (valor) => setObservaciones(SIN_OBSERVACIONES.test(aPalabras(valor)) ? '' : valor),
        opcional: true,
    };
    const campos = [campoTipo, campoIntensidad, campoCuando, campoObservaciones];

    /** "Tengo dolor de cabeza intensidad 7 hace dos horas": llena los tres campos de una vez. */
    const dictado = (texto: string, pendiente: string | null): Resultado[] | null => {
        // Si VITA preguntó por cuándo o por las observaciones, lo dicho es la respuesta tal cual
        if (pendiente === 'Cuándo' || pendiente === 'Observaciones') return null;
        const conIntensidad = /\b(intensidad|nivel|de 10|de diez)\b/.test(aPalabras(texto));
        const partes = separarSintoma(texto, true) ?? (conIntensidad ? separarSintoma(texto, false) : null);
        if (!partes) {
            // "Hace dos horas", "ayer en la noche": es el cuándo
            if (!pendiente && interpretarCuando(texto)) return [{ tipo: 'campo', campo: campoCuando, valor: texto }];
            return null;
        }
        const resultados: Resultado[] = [];
        if (partes.tipo) resultados.push({ tipo: 'campo', campo: campoTipo, valor: partes.tipo });
        if (partes.intensidad) resultados.push({ tipo: 'campo', campo: campoIntensidad, valor: String(partes.intensidad) });
        if (partes.cuando) resultados.push({ tipo: 'campo', campo: campoCuando, valor: partes.cuando });
        return resultados.length ? resultados : null;
    };

    const titulo = editando ? 'Editar síntoma' : 'Registrar síntoma';

    useComandosPantalla({
        titulo,
        descripcion: editando
            ? 'Editar síntoma. Dime qué quieres cambiar, por ejemplo: la intensidad es 5, y luego di: guardar.'
            : 'Registrar síntoma. Dime qué sientes y qué tan fuerte, del 1 al 10. Por ejemplo: dolor de cabeza intensidad 7.',
        ejemplos: [
            'tengo dolor de cabeza intensidad 7',
            'la intensidad es 5',
            'fue hace dos horas',
            'las observaciones son: empezó después del almuerzo',
            'guardar',
        ],
        // Mientras carga el síntoma a editar no se pregunta nada
        campos: editando && !original ? [] : campos,
        pasosOpcionales: editando
            ? []
            : [
                {
                    pregunta: cuando
                        ? 'Responde sí o no: ¿quieres agregar una observación?'
                        : 'Responde sí o no: ¿quieres decir cuándo empezó o agregar una observación? Si no, se guarda con la hora de ahora.',
                    campos: ['Cuándo', 'Observaciones'],
                },
            ],
        acciones: [
            {
                frases: ['guardar', 'guarda', 'guardalo', 'guardala', 'guardar sintoma', 'guardar cambios', 'registrar', 'registralo', 'terminar', 'enviar', 'listo'],
                etiqueta: editando ? 'guardar los cambios' : 'guardar el síntoma',
                ejecutar: () => void guardar(),
            },
            { frases: ['volver', 'atras', 'regresar', 'no guardar', 'salir del formulario'], ejecutar: volver },
            ...accionesComunesVoz('USUARIO', anunciar),
        ],
        dictado,
    });

    // ----- Pantalla --------------------------------------------------------------------------------

    const opcionesCuando = editando
        ? [
            { valor: cuandoOriginal, titulo: 'Como estaba' },
            { valor: 'ahora', titulo: 'Ahora' },
            { valor: 'hace 1 hora', titulo: 'Hace 1 hora' },
            { valor: 'ayer', titulo: 'Ayer' },
        ]
        : [
            { valor: '', titulo: 'Ahora' },
            { valor: 'hace 1 hora', titulo: 'Hace 1 hora' },
            { valor: 'hace 3 horas', titulo: 'Hace 3 horas' },
            { valor: 'ayer', titulo: 'Ayer' },
        ];
    const opcionCuando = opcionesCuando.find((o) => o.valor === cuando.trim().toLowerCase())?.valor ?? '__otro';

    return (
        <FondoPantalla>
            <Encabezado volver alVolver={volver} titulo={titulo} subtitulo="¿Qué sientes y qué tan fuerte?" />

            {editando && !original ? (
                <EstadoCarga cargando={cargandoDatos} error={errorCarga} reintentar={cargar} hayDatos={false} />
            ) : (
                <>
                    <Tarjeta titulo="Síntoma" icono="sintomas">
                        <Campo
                            etiqueta="¿Qué sientes?"
                            icono="sintomas"
                            placeholder="Ej: Dolor de cabeza"
                            value={tipo}
                            onChangeText={cambiarTipo}
                            error={errores.tipo}
                            autoCapitalize="sentences"
                            maxLength={100}
                        />
                        <View style={styles.sugerencias}>
                            <Texto variante="pequeno" color="textoSecundario">
                                Toca uno para elegirlo:
                            </Texto>
                            <OpcionesFiltro
                                etiqueta="Síntoma sugerido"
                                opciones={sugerencias.map((s) => ({ valor: s, titulo: s }))}
                                valor={sugerencias.find((s) => aPalabras(s) === aPalabras(tipo)) ?? ''}
                                onCambiar={cambiarTipo}
                            />
                        </View>
                        <SelectorIntensidad
                            valor={intensidad}
                            onCambiar={(n) => {
                                setIntensidad(n);
                                setErrores((e) => ({ ...e, intensidad: undefined }));
                            }}
                            error={errores.intensidad}
                        />
                    </Tarjeta>

                    <Tarjeta titulo="Más detalles (opcional)" icono="reloj">
                        <View style={styles.sugerencias}>
                            <Texto variante="etiqueta">¿Cuándo?</Texto>
                            <OpcionesFiltro etiqueta="Cuándo" opciones={opcionesCuando} valor={opcionCuando} onCambiar={cambiarCuando} />
                        </View>
                        <Campo
                            etiqueta="Otra fecha y hora"
                            icono="calendario"
                            placeholder="Ej: ayer a las 8 pm, o 14/10/2026 09:30"
                            value={opcionCuando === '__otro' ? cuando : ''}
                            onChangeText={cambiarCuando}
                            error={errores.cuando}
                            ayuda={ayudaCuando}
                            returnKeyType="next"
                            onSubmitEditing={() => observacionesRef.current?.focus()}
                        />
                        <Campo
                            ref={observacionesRef}
                            etiqueta="Observaciones"
                            icono="nota"
                            placeholder="Ej: empezó después del almuerzo"
                            value={observaciones}
                            onChangeText={cambiarObservaciones}
                            error={errores.observaciones}
                            multiline
                            maxLength={1000}
                        />
                    </Tarjeta>

                    <View style={styles.botones}>
                        <Boton titulo={editando ? 'Guardar cambios' : 'Guardar síntoma'} icono="check" onPress={guardar} cargando={guardando} />
                        {errorGeneral && <Aviso mensaje={errorGeneral} />}
                        <Boton titulo="Cancelar" variante="secundario" onPress={volver} />
                    </View>
                </>
            )}
        </FondoPantalla>
    );
}

const styles = StyleSheet.create({
    sugerencias: {
        gap: Espacio.s,
    },
    botones: {
        gap: Espacio.m,
        marginBottom: Espacio.xl,
    },
});