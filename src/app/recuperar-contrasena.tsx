import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type TextInput } from 'react-native';

import { Aviso } from '@/components/vita/aviso';
import { Boton } from '@/components/vita/boton';
import { Campo, NotaCamposObligatorios } from '@/components/vita/campo';
import { Encabezado } from '@/components/vita/encabezado';
import { FondoPantalla } from '@/components/vita/fondo-pantalla';
import { Tarjeta } from '@/components/vita/tarjeta';
import { Texto } from '@/components/vita/texto';
import { Espacio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';
import { useComandosPantalla } from '@/context/asistente-context';
import { restablecerContrasena, solicitarCodigoRecuperacion } from '@/services/authService';
import { mensajeDeError } from '@/utils/sesion';
import { campoDelError } from '@/utils/textos';
import { errorContrasena, errorCorreo } from '@/utils/validaciones';

type Errores = Partial<Record<'correo' | 'codigo' | 'nueva' | 'confirmacion', string>>;

/** El backend deja pedir un código nuevo una vez por minuto. */
const ESPERA_REENVIO_S = 60;

/**
 * "¿Olvidaste tu contraseña?" en dos pasos:
 * 1. Se escribe el correo y llega un código de 6 dígitos (vence en 15 minutos).
 * 2. Se escribe el código y la nueva contraseña.
 */
export default function RecuperarContrasenaScreen() {
    const params = useLocalSearchParams<{ correo?: string }>();
    const { anunciar, colores } = useAccesibilidad();

    const [paso, setPaso] = useState<'correo' | 'codigo'>('correo');
    const [correo, setCorreo] = useState(params.correo ?? '');
    const [codigo, setCodigo] = useState('');
    const [nueva, setNueva] = useState('');
    const [confirmacion, setConfirmacion] = useState('');
    const [errores, setErrores] = useState<Errores>({});
    const [aviso, setAviso] = useState<{ tipo: 'exito' | 'error' | 'info'; mensaje: string } | null>(null);
    const [cargando, setCargando] = useState(false);
    const [espera, setEspera] = useState(0);

    const nuevaRef = useRef<TextInput>(null);
    const confirmacionRef = useRef<TextInput>(null);

    // Cuenta regresiva para poder pedir otro código
    useEffect(() => {
        if (espera <= 0) return;
        const t = setTimeout(() => setEspera((s) => s - 1), 1000);
        return () => clearTimeout(t);
    }, [espera]);

    const volver = () => {
        if (paso === 'codigo') {
            setPaso('correo');
            setErrores({});
            setAviso(null);
            return;
        }
        if (router.canGoBack()) router.back();
        else router.replace({ pathname: '/login', params: correo.trim() ? { correo: correo.trim() } : {} });
    };

    const quitarError = (campo: keyof Errores) => setErrores((e) => (e[campo] ? { ...e, [campo]: undefined } : e));

    // ----- Paso 1: pedir el código -------------------------------------------------------------

    const pedirCodigo = async () => {
        const error = errorCorreo(correo, 'Escribe tu correo');
        setErrores(error ? { correo: error } : {});
        setAviso(null);
        if (error) {
            anunciar(error);
            return;
        }
        setCargando(true);
        try {
            await solicitarCodigoRecuperacion({ correo: correo.trim() });
            const mensaje = `Si el correo está registrado, te enviamos un código de 6 dígitos a ${correo.trim()}. El código vence en 15 minutos.`;
            setAviso({ tipo: 'info', mensaje });
            setPaso('codigo');
            setEspera(ESPERA_REENVIO_S);
            anunciar(`${mensaje} Ahora escribe el código y tu nueva contraseña.`);
        } catch (e) {
            const mensaje = mensajeDeError(e, 'No pudimos enviar el código.');
            if (/correo/i.test(mensaje)) setErrores({ correo: mensaje });
            else setAviso({ tipo: 'error', mensaje });
            anunciar(mensaje);
        } finally {
            setCargando(false);
        }
    };

    const reenviar = async () => {
        if (espera > 0) {
            anunciar(`Podrás pedir otro código en ${espera} segundos.`);
            return;
        }
        setCodigo('');
        await pedirCodigo();
    };

    // ----- Paso 2: restablecer -----------------------------------------------------------------

    const restablecer = async () => {
        const encontrados: Errores = {};
        if (!codigo.trim()) encontrados.codigo = 'Escribe el código que llegó a tu correo';
        else if (!/^\d{6}$/.test(codigo.trim())) encontrados.codigo = 'El código debe tener 6 dígitos';
        const errorNueva = errorContrasena(nueva);
        if (errorNueva) encontrados.nueva = 'La nueva contraseña debe tener al menos 8 caracteres';
        if (!encontrados.nueva && confirmacion !== nueva) encontrados.confirmacion = 'Las contraseñas no coinciden';
        setErrores(encontrados);
        setAviso(null);
        if (Object.keys(encontrados).length > 0) {
            anunciar(`Revisa el formulario. ${Object.values(encontrados).join('. ')}`);
            return;
        }
        setCargando(true);
        try {
            await restablecerContrasena({ correo: correo.trim(), codigo: codigo.trim(), contrasenaNueva: nueva });
            anunciar('Tu contraseña se actualizó correctamente. Ya puedes iniciar sesión.');
            router.replace({ pathname: '/login', params: { correo: correo.trim(), restablecida: '1' } });
        } catch (e) {
            const mensaje = mensajeDeError(e, 'No pudimos actualizar la contraseña.');
            const campo = campoDelError<keyof Errores>(mensaje, [
                [/c[oó]digo/i, 'codigo'],
                [/contrase/i, 'nueva'],
            ]);
            if (campo) setErrores({ [campo]: mensaje });
            else setAviso({ tipo: 'error', mensaje });
            anunciar(mensaje);
        } finally {
            setCargando(false);
        }
    };

    // ----- Voz ---------------------------------------------------------------------------------

    useComandosPantalla(
        paso === 'correo'
            ? {
                  titulo: 'Recuperar contraseña',
                  descripcion:
                      'Recuperar contraseña. Escribe el correo con el que te registraste y te enviaremos un código de 6 dígitos para crear una nueva contraseña.',
                  ejemplos: ['mi correo es maria arroba gmail punto com', 'enviar código', 'volver'],
                  campos: [
                      {
                          claves: ['correo electronico', 'correo', 'email', 'mail'],
                          etiqueta: 'Correo electrónico',
                          pregunta: '¿Cuál es el correo con el que te registraste?',
                          tipo: 'correo',
                          valor: correo,
                          asignar: (v) => {
                              setCorreo(v);
                              quitarError('correo');
                          },
                      },
                  ],
                  acciones: [
                      {
                          frases: ['enviar codigo', 'enviar', 'pedir codigo', 'continuar', 'siguiente'],
                          etiqueta: 'enviar el código',
                          ejecutar: () => void pedirCodigo(),
                      },
                      { frases: ['volver', 'atras', 'regresar', 'iniciar sesion'], ejecutar: volver },
                  ],
              }
            : {
                  titulo: 'Nueva contraseña',
                  descripcion: `Nueva contraseña. Escribe el código de 6 dígitos que enviamos a ${correo.trim()}, tu nueva contraseña y repítela para confirmarla.`,
                  ejemplos: ['el código es 4 8 2 9 1 5', 'la nueva contraseña es …', 'guardar', 'reenviar código'],
                  campos: [
                      {
                          claves: ['codigo de verificacion', 'codigo', 'el codigo'],
                          etiqueta: 'Código',
                          pregunta: '¿Cuál es el código de 6 dígitos que llegó a tu correo?',
                          tipo: 'numero',
                          valor: codigo,
                          asignar: (v) => {
                              setCodigo(v.replace(/\D/g, '').slice(0, 6));
                              quitarError('codigo');
                          },
                      },
                      {
                          claves: ['nueva contrasena', 'contrasena nueva', 'clave nueva', 'nueva clave', 'contrasena', 'nueva'],
                          etiqueta: 'Nueva contraseña',
                          pregunta: '¿Cuál quieres que sea tu nueva contraseña? Debe tener al menos 8 caracteres.',
                          tipo: 'contrasena',
                          valor: nueva,
                          asignar: (v) => {
                              setNueva(v);
                              quitarError('nueva');
                          },
                      },
                      {
                          claves: ['confirmar contrasena', 'confirmacion', 'confirma', 'repite la nueva', 'repetir contrasena', 'otra vez la nueva'],
                          etiqueta: 'Confirmar contraseña',
                          pregunta: 'Repite la nueva contraseña para confirmarla.',
                          tipo: 'contrasena',
                          valor: confirmacion,
                          asignar: (v) => {
                              setConfirmacion(v);
                              quitarError('confirmacion');
                          },
                      },
                  ],
                  acciones: [
                      {
                          frases: ['guardar', 'restablecer', 'cambiar contrasena', 'listo', 'confirmar'],
                          etiqueta: 'guardar la nueva contraseña',
                          ejecutar: () => void restablecer(),
                      },
                      { frases: ['reenviar codigo', 'reenviar', 'otro codigo', 'no me llego'], ejecutar: () => void reenviar() },
                      { frases: ['cambiar correo', 'otro correo', 'volver', 'atras', 'regresar'], ejecutar: volver },
                  ],
              },
    );

    return (
        <FondoPantalla>
            <Encabezado
                volver
                alVolver={volver}
                alVolverPrimero
                icono="llave"
                titulo={paso === 'correo' ? 'Recuperar contraseña' : 'Nueva contraseña'}
                subtitulo={
                    paso === 'correo'
                        ? 'Te enviaremos un código a tu correo para que crees una contraseña nueva.'
                        : 'Escribe el código que llegó a tu correo y elige una contraseña nueva.'
                }
            />

            <View style={styles.pasos} accessibilityLabel={`Paso ${paso === 'correo' ? 1 : 2} de 2`}>
                {[1, 2].map((n) => {
                    const activo = (paso === 'correo' ? 1 : 2) >= n;
                    return <View key={n} style={[styles.barraPaso, { backgroundColor: activo ? colores.primario : colores.borde }]} />;
                })}
            </View>

            {aviso && (
                <View style={styles.aviso}>
                    <Aviso tipo={aviso.tipo} mensaje={aviso.mensaje} />
                </View>
            )}

            {paso === 'correo' ? (
                <Tarjeta>
                    <Campo
                        etiqueta="Correo electrónico"
                        obligatorio
                        icono="correo"
                        placeholder="tucorreo@ejemplo.com"
                        value={correo}
                        onChangeText={(v) => {
                            setCorreo(v);
                            quitarError('correo');
                        }}
                        error={errores.correo}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoComplete="email"
                        textContentType="emailAddress"
                        returnKeyType="go"
                        onSubmitEditing={() => void pedirCodigo()}
                    />
                    <NotaCamposObligatorios />
                    <Boton titulo="Enviar código" icono="correo" onPress={() => void pedirCodigo()} cargando={cargando} />
                </Tarjeta>
            ) : (
                <Tarjeta>
                    <Campo
                        etiqueta="Código de 6 dígitos"
                        obligatorio
                        icono="insignia"
                        placeholder="Ej: 482915"
                        value={codigo}
                        onChangeText={(v) => {
                            setCodigo(v.replace(/\D/g, '').slice(0, 6));
                            quitarError('codigo');
                        }}
                        error={errores.codigo}
                        ayuda="Revisa también la carpeta de spam. El código vence en 15 minutos."
                        keyboardType="number-pad"
                        autoComplete="one-time-code"
                        textContentType="oneTimeCode"
                        maxLength={6}
                        returnKeyType="next"
                        onSubmitEditing={() => nuevaRef.current?.focus()}
                    />
                    <Campo
                        ref={nuevaRef}
                        etiqueta="Nueva contraseña"
                        obligatorio
                        icono="llave"
                        placeholder="Mínimo 8 caracteres"
                        value={nueva}
                        onChangeText={(v) => {
                            setNueva(v);
                            quitarError('nueva');
                        }}
                        error={errores.nueva}
                        esContrasena
                        autoComplete="new-password"
                        textContentType="newPassword"
                        returnKeyType="next"
                        onSubmitEditing={() => confirmacionRef.current?.focus()}
                    />
                    <Campo
                        ref={confirmacionRef}
                        etiqueta="Confirmar contraseña"
                        obligatorio
                        icono="llave"
                        placeholder="Repite la nueva contraseña"
                        value={confirmacion}
                        onChangeText={(v) => {
                            setConfirmacion(v);
                            quitarError('confirmacion');
                        }}
                        error={errores.confirmacion}
                        esContrasena
                        autoComplete="new-password"
                        returnKeyType="go"
                        onSubmitEditing={() => void restablecer()}
                    />
                    <NotaCamposObligatorios />
                    <Boton titulo="Guardar contraseña" icono="check" onPress={() => void restablecer()} cargando={cargando} />

                    <View style={styles.enlaces}>
                        <Pressable
                            onPress={() => void reenviar()}
                            accessibilityRole="button"
                            accessibilityState={{ disabled: espera > 0 }}
                            accessibilityLabel={espera > 0 ? `Reenviar código, disponible en ${espera} segundos` : 'Reenviar código'}
                            style={styles.enlace}
                        >
                            <Texto variante="cuerpo" peso="700" color={espera > 0 ? 'textoTenue' : 'primario'}>
                                {espera > 0 ? `Reenviar código (${espera} s)` : 'Reenviar código'}
                            </Texto>
                        </Pressable>
                        <Pressable onPress={volver} accessibilityRole="button" accessibilityLabel="Usar otro correo" style={styles.enlace}>
                            <Texto variante="cuerpo" peso="700" color="primario">
                                Usar otro correo
                            </Texto>
                        </Pressable>
                    </View>
                </Tarjeta>
            )}
        </FondoPantalla>
    );
}

const styles = StyleSheet.create({
    pasos: {
        flexDirection: 'row',
        gap: Espacio.s,
        marginBottom: Espacio.l,
    },
    barraPaso: {
        flex: 1,
        height: 6,
        borderRadius: 3,
    },
    aviso: {
        marginBottom: Espacio.l,
    },
    enlaces: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: Espacio.s,
    },
    enlace: {
        paddingVertical: Espacio.s,
    },
});
