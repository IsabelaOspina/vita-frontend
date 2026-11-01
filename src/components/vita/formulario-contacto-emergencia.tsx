import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';

import { Espacio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';
import { useComandosPantalla } from '@/context/asistente-context';
import { eliminarContactoEmergencia, guardarContactoEmergencia, obtenerContactoEmergencia } from '@/services/emergenciaService';
import { aPalabras, type CampoVoz } from '@/utils/comandos-voz';
import { telefonoDiezDigitos } from '@/utils/emergencia';
import { dejarAvisoPendiente } from '@/utils/fuente-sintomas';
import { mensajeDeError } from '@/utils/sesion';
import { campoDelError } from '@/utils/textos';
import { errorNombre, errorParentesco, errorTelefono } from '@/utils/validaciones';

import { accionesComunesVoz } from './acciones-cuenta';
import { Aviso } from './aviso';
import { Boton } from './boton';
import { Campo, NotaCamposObligatorios } from './campo';
import { Encabezado } from './encabezado';
import { EstadoCarga } from './estado-carga';
import { FondoPantalla } from './fondo-pantalla';
import { Tarjeta } from './tarjeta';
import { Texto } from './texto';

type Errores = Partial<Record<'nombre' | 'telefono' | 'parentesco', string>>;

/**
 * Registrar, cambiar o quitar el contacto de emergencia (paciente): la persona que recibe el mensaje
 * de texto cuando se pide ayuda. Las reglas son las del backend: nombre y parentesco solo con letras,
 * y un celular de Colombia de 10 dígitos.
 */
export function FormularioContactoEmergencia() {
    const { anunciar } = useAccesibilidad();

    const [nombre, setNombre] = useState('');
    const [telefono, setTelefono] = useState('');
    const [parentesco, setParentesco] = useState('');
    const [existe, setExiste] = useState(false);
    const [cargando, setCargando] = useState(true);
    const [errorCarga, setErrorCarga] = useState<string | null>(null);
    const [errores, setErrores] = useState<Errores>({});
    const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
    const [guardando, setGuardando] = useState(false);
    const [confirmandoQuitar, setConfirmandoQuitar] = useState(false);

    const telefonoRef = useRef<TextInput>(null);
    const parentescoRef = useRef<TextInput>(null);

    const cargar = async () => {
        setCargando(true);
        setErrorCarga(null);
        try {
            const c = await obtenerContactoEmergencia();
            setExiste(!!c);
            if (c) {
                setNombre(c.nombre);
                // El backend lo devuelve con +57; para editarlo se muestran los 10 dígitos
                setTelefono(telefonoDiezDigitos(c.telefono));
                setParentesco(c.parentesco ?? '');
            }
        } catch (e) {
            setErrorCarga(mensajeDeError(e, 'No pudimos cargar tu contacto de emergencia.'));
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        void cargar();
    }, []);

    const quitarError = (c: keyof Errores) => setErrores((e) => (e[c] ? { ...e, [c]: undefined } : e));
    const volver = () => (router.canGoBack() ? router.back() : router.replace('/paciente/mi-cuenta'));

    const guardar = async () => {
        const e: Errores = {};
        const eNombre = errorNombre(nombre, 'Escribe el nombre de tu contacto');
        const eTelefono = errorTelefono(telefono, { obligatorio: true, mensajeVacio: 'Escribe el celular de tu contacto' });
        const eParentesco = errorParentesco(parentesco, 'Escribe el parentesco, por ejemplo: madre, hermano o amiga');
        if (eNombre) e.nombre = eNombre;
        if (eTelefono) e.telefono = eTelefono;
        if (eParentesco) e.parentesco = eParentesco;
        setErrores(e);
        setErrorGeneral(null);
        if (Object.keys(e).length) {
            anunciar(`Revisa el formulario. ${Object.values(e).join('. ')}`);
            return;
        }
        setGuardando(true);
        try {
            const c = await guardarContactoEmergencia({ nombre: nombre.trim(), telefono: telefono.trim(), parentesco: parentesco.trim() });
            const mensaje = `Listo, ${c.nombre} es tu contacto de emergencia. Si pides ayuda, le enviaremos un mensaje de texto.`;
            anunciar(mensaje);
            dejarAvisoPendiente(mensaje);
            volver();
        } catch (err) {
            const mensaje = mensajeDeError(err, 'No pudimos guardar el contacto.');
            const campo = campoDelError<keyof Errores>(mensaje, [
                [/nombre/i, 'nombre'],
                [/tel[eé]fono|celular|d[ií]gitos/i, 'telefono'],
                [/parentesco/i, 'parentesco'],
            ]);
            if (campo) setErrores({ [campo]: mensaje });
            else setErrorGeneral(mensaje);
            anunciar(mensaje);
        } finally {
            setGuardando(false);
        }
    };

    const quitar = async () => {
        setGuardando(true);
        try {
            await eliminarContactoEmergencia();
            const mensaje = 'Listo, quitamos tu contacto de emergencia. Para pedir ayuda tendrás que registrar uno nuevo.';
            anunciar(mensaje);
            dejarAvisoPendiente(mensaje);
            volver();
        } catch (err) {
            const mensaje = mensajeDeError(err, 'No pudimos quitar el contacto.');
            setErrorGeneral(mensaje);
            anunciar(mensaje);
        } finally {
            setGuardando(false);
            setConfirmandoQuitar(false);
        }
    };

    // ----- Asistente de voz -----------------------------------------------------------------------

    const sinNada = (v: string) => /^(no|ninguno|nada)$/.test(aPalabras(v));
    const campos: CampoVoz[] = [
        {
            claves: ['nombre', 'se llama', 'nombre del contacto', 'mi contacto es', 'contacto'],
            etiqueta: 'Nombre',
            pregunta: '¿Cómo se llama tu contacto de emergencia?',
            tipo: 'nombre',
            valor: nombre,
            asignar: (v) => {
                setNombre(sinNada(v) ? '' : v);
                quitarError('nombre');
            },
        },
        {
            claves: ['telefono', 'celular', 'numero', 'su numero', 'el numero'],
            etiqueta: 'Celular',
            pregunta: '¿Cuál es su número de celular? Son 10 dígitos.',
            tipo: 'numero',
            valor: telefono,
            asignar: (v) => {
                setTelefono(v.replace(/\D/g, '').slice(-10));
                quitarError('telefono');
            },
        },
        {
            claves: ['parentesco', 'es mi', 'relacion'],
            etiqueta: 'Parentesco',
            pregunta: '¿Qué es de ti? Por ejemplo: madre, hermano, amiga o cuidador.',
            tipo: 'texto',
            valor: parentesco,
            asignar: (v) => {
                setParentesco(v.charAt(0).toUpperCase() + v.slice(1));
                quitarError('parentesco');
            },
        },
    ];

    const titulo = existe ? 'Contacto de emergencia' : 'Registrar contacto de emergencia';

    useComandosPantalla({
        cargando,
        titulo,
        descripcion: existe
            ? `Contacto de emergencia: ${nombre}, ${parentesco}. Dime qué quieres cambiar, por ejemplo: el celular es 300 123 4567, y luego di: guardar. También puedes decir: quitar contacto.`
            : 'Registrar contacto de emergencia. Dime su nombre, su celular de 10 dígitos y qué es de ti. Por ejemplo: se llama Ana Gómez, el celular es 300 123 4567, es mi madre.',
        ejemplos: ['se llama Ana Gómez', 'el celular es 300 123 4567', 'el parentesco es madre', 'guardar'],
        campos: cargando ? [] : campos,
        acciones: [
            { frases: ['guardar', 'guarda', 'guardalo', 'listo', 'registrar', 'terminar'], etiqueta: 'guardar el contacto', ejecutar: () => void guardar() },
            ...(existe
                ? [
                    {
                        frases: ['quitar contacto', 'eliminar contacto', 'borrar contacto', 'quitar el contacto'],
                        etiqueta: 'quitar el contacto',
                        confirmar: `¿Seguro que quieres quitar a ${nombre} como contacto de emergencia?`,
                        ejecutar: () => void quitar(),
                    },
                ]
                : []),
            { frases: ['volver', 'atras', 'regresar', 'cancelar', 'no guardar'], ejecutar: volver },
            ...accionesComunesVoz('USUARIO', anunciar),
        ],
    });

    return (
        <FondoPantalla>
            <Encabezado
                volver
                alVolver={volver}
                icono="contactoEmergencia"
                titulo={titulo}
                subtitulo="Es la persona que recibirá un mensaje de texto si pides ayuda de emergencia."
            />

            {cargando || errorCarga ? (
                <EstadoCarga cargando={cargando} error={errorCarga} reintentar={cargar} hayDatos={false} />
            ) : (
                <>
                    <Tarjeta titulo="Datos del contacto" icono="contactoEmergencia">
                        <Campo
                            etiqueta="Nombre"
                            obligatorio
                            icono="persona"
                            placeholder="Ej: Ana Gómez"
                            value={nombre}
                            onChangeText={(v) => {
                                setNombre(v);
                                quitarError('nombre');
                            }}
                            error={errores.nombre}
                            autoCapitalize="words"
                            returnKeyType="next"
                            onSubmitEditing={() => telefonoRef.current?.focus()}
                            maxLength={150}
                        />
                        <Campo
                            ref={telefonoRef}
                            etiqueta="Celular"
                            obligatorio
                            icono="telefono"
                            placeholder="Ej: 3001234567"
                            value={telefono}
                            onChangeText={(v) => {
                                setTelefono(v.replace(/\D/g, '').slice(0, 10));
                                quitarError('telefono');
                            }}
                            error={errores.telefono}
                            ayuda="Celular de Colombia, 10 dígitos. A este número llegará el mensaje de alerta."
                            keyboardType="phone-pad"
                            textContentType="telephoneNumber"
                            maxLength={10}
                            returnKeyType="next"
                            onSubmitEditing={() => parentescoRef.current?.focus()}
                        />
                        <Campo
                            ref={parentescoRef}
                            etiqueta="Parentesco"
                            obligatorio
                            icono="parentesco"
                            placeholder="Ej: Madre, hermano, amiga, cuidador"
                            value={parentesco}
                            onChangeText={(v) => {
                                setParentesco(v);
                                quitarError('parentesco');
                            }}
                            error={errores.parentesco}
                            autoCapitalize="sentences"
                            returnKeyType="go"
                            onSubmitEditing={() => void guardar()}
                            maxLength={60}
                        />
                    </Tarjeta>

                    <View style={styles.botones}>
                        <NotaCamposObligatorios />
                        <Boton titulo={existe ? 'Guardar cambios' : 'Guardar contacto'} icono="check" onPress={() => void guardar()} cargando={guardando && !confirmandoQuitar} />
                        {errorGeneral && <Aviso mensaje={errorGeneral} />}
                        <Boton titulo="Cancelar" variante="secundario" onPress={volver} />
                    </View>

                    {existe && (
                        <Tarjeta titulo="Quitar contacto" icono="eliminar">
                            {confirmandoQuitar ? (
                                <>
                                    <Texto variante="cuerpo">
                                        ¿Seguro que quieres quitar a {nombre} como contacto de emergencia? Para pedir ayuda tendrás que registrar uno nuevo.
                                    </Texto>
                                    <Boton titulo="Sí, quitar contacto" icono="eliminar" variante="peligro" onPress={() => void quitar()} cargando={guardando} />
                                    <Boton titulo="No, dejarlo" variante="secundario" onPress={() => setConfirmandoQuitar(false)} />
                                </>
                            ) : (
                                <Boton titulo="Quitar contacto de emergencia" icono="eliminar" variante="secundario" onPress={() => setConfirmandoQuitar(true)} />
                            )}
                        </Tarjeta>
                    )}
                </>
            )}
        </FondoPantalla>
    );
}

const styles = StyleSheet.create({
    botones: {
        gap: Espacio.m,
        marginBottom: Espacio.xl,
    },
});