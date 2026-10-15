import { Link, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';

import { Aviso } from '@/components/vita/aviso';
import { BarraAccesibilidad } from '@/components/vita/barra-accesibilidad';
import { Boton } from '@/components/vita/boton';
import { Campo } from '@/components/vita/campo';
import { FondoPantalla } from '@/components/vita/fondo-pantalla';
import { LogoVita } from '@/components/vita/logo-vita';
import { Texto } from '@/components/vita/texto';
import { Espacio, Radio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';
import { useComandosPantalla } from '@/context/asistente-context';
import { ApiError } from '@/services/api';
import { iniciarSesion } from '@/services/authService';
import { rutaDeInicio } from '@/utils/sesion';
import { campoDelError } from '@/utils/textos';

/** Convierte cualquier error en un mensaje entendible para el usuario. */
function mensajeDeError(e: unknown): string {
    // El backend respondió con un error (por ejemplo 401 "Correo o contraseña incorrectos")
    if (e instanceof ApiError) return e.message;
    // No hubo respuesta: el servidor está apagado, la IP del .env está mal o no hay internet
    return 'No pudimos conectarnos con el servidor. Revisa tu conexión e intenta de nuevo.';
}

type Errores = { correo?: string; contrasena?: string };

function validar(correo: string, contrasena: string): Errores {
    const errores: Errores = {};
    if (!correo.trim()) errores.correo = 'Escribe tu correo';
    else if (!/^[^\s@]+@[^\s@]+$/.test(correo.trim())) errores.correo = 'Revisa el correo, parece incompleto';
    if (!contrasena) errores.contrasena = 'Escribe tu contraseña';
    return errores;
}

export default function LoginScreen() {
    const params = useLocalSearchParams<{ correo?: string; registrado?: string }>();
    const { colores, altoContraste, anunciar } = useAccesibilidad();

    const [correo, setCorreo] = useState(params.correo ?? '');
    const [contrasena, setContrasena] = useState('');
    const [errores, setErrores] = useState<Errores>({});
    const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
    // El aviso de "cuenta creada" se toma una sola vez del parámetro y luego vive en el estado,
    // para poder quitarlo cuando la persona empieza a escribir o inicia sesión
    const [cuentaCreada, setCuentaCreada] = useState(params.registrado === '1');

    // Se borra el parámetro de la dirección para que el aviso no vuelva a aparecer
    useEffect(() => {
        if (params.registrado) router.setParams({ registrado: undefined });
        // Solo al abrir la pantalla
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const ocultarAvisoCuentaCreada = () => {
        if (cuentaCreada) setCuentaCreada(false);
    };
    const [cargando, setCargando] = useState(false);
    const contrasenaRef = useRef<TextInput>(null);

    const enviar = async () => {
        const encontrados = validar(correo, contrasena);
        setErrores(encontrados);
        setErrorGeneral(null);
        setCuentaCreada(false);
        if (Object.keys(encontrados).length > 0) {
            // Se leen los errores concretos, no solo un aviso general
            anunciar(`Revisa el formulario. ${Object.values(encontrados).join('. ')}`);
            return;
        }

        setCargando(true);
        try {
            // authService guarda el token y devuelve el usuario
            const respuesta = await iniciarSesion({ correo: correo.trim(), contrasena });
            const primerNombre = respuesta.usuario.nombre.split(' ')[0];
            anunciar(`¡Bienvenido, ${primerNombre}!`);
            // Cada rol tiene su pantalla principal: paciente, personal de salud o administrador
            router.replace(rutaDeInicio(respuesta.usuario.rol));
        } catch (e) {
            const mensaje = mensajeDeError(e);
            // El error va debajo del campo que lo causó; si no es de un campo, debajo del botón
            const campo = campoDelError<keyof Errores>(mensaje, [
                [/inactivo/i, 'correo'],
                [/contrase/i, 'contrasena'],
                [/correo/i, 'correo'],
            ]);
            if (campo) setErrores({ [campo]: mensaje });
            else setErrorGeneral(mensaje);
            anunciar(mensaje);
        } finally {
            setCargando(false);
        }
    };

    // Lo que el asistente "Oye VITA" puede hacer en esta pantalla
    useComandosPantalla({
        titulo: 'Inicio de sesión',
        descripcion: cuentaCreada
            ? 'Tu cuenta fue creada. Ahora inicia sesión con tu correo y contraseña.'
            : 'Inicio de sesión. Escribe tu correo y tu contraseña, o díctalos con Oye VITA.',
        ejemplos: [
            'mi correo es isabela arroba gmail punto com',
            'mi contraseña es, y la dices',
            'o todo junto: mi correo es …, y mi contraseña es …, e inicia sesión',
            'quiero registrarme',
        ],
        campos: [
            {
                claves: ['correo electronico', 'correo', 'email', 'mail'],
                etiqueta: 'Correo electrónico',
                pregunta: '¿Cuál es tu correo electrónico?',
                tipo: 'correo',
                valor: correo,
                asignar: (valor) => {
                    setCorreo(valor);
                    ocultarAvisoCuentaCreada();
                },
            },
            {
                claves: ['contrasena', 'clave'],
                etiqueta: 'Contraseña',
                pregunta: '¿Cuál es tu contraseña?',
                tipo: 'contrasena',
                valor: contrasena,
                asignar: (valor) => {
                    setContrasena(valor);
                    ocultarAvisoCuentaCreada();
                },
            },
        ],
        acciones: [
            { frases: ['iniciar sesion', 'inicia sesion', 'entrar', 'ingresar'], etiqueta: 'iniciar sesión', ejecutar: enviar },
            {
                frases: ['registrarme', 'registrar', 'crear cuenta', 'crear una cuenta', 'ir a registro', 'registro'],
                ejecutar: () => router.push('/registro'),
            },
        ],
    });

    return (
        <FondoPantalla>
            <View style={styles.encabezado}>
                <LogoVita />
                <View style={styles.titulos}>
                    <Texto variante="titulo" centrado accessibilityRole="header">
                        ¡Hola de nuevo!
                    </Texto>
                    <Texto variante="cuerpo" color="textoSecundario" centrado>
                        Ingresa para seguir cuidando tu salud
                    </Texto>
                </View>
            </View>

            <View
                style={[
                    styles.tarjeta,
                    {
                        backgroundColor: colores.superficie,
                        borderColor: altoContraste ? colores.borde : 'transparent',
                    },
                    !altoContraste && styles.sombra,
                ]}>
                {cuentaCreada && (
                    <Aviso tipo="exito" mensaje="¡Tu cuenta fue creada! Ahora inicia sesión." />
                )}
                <Campo
                    etiqueta="Correo electrónico"
                    icono="correo"
                    placeholder="tucorreo@ejemplo.com"
                    value={correo}
                    onChangeText={(texto) => {
                        setCorreo(texto);
                        ocultarAvisoCuentaCreada();
                    }}
                    error={errores.correo}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    textContentType="emailAddress"
                    returnKeyType="next"
                    onSubmitEditing={() => contrasenaRef.current?.focus()}
                />

                <Campo
                    ref={contrasenaRef}
                    etiqueta="Contraseña"
                    icono="candado"
                    placeholder="Tu contraseña"
                    value={contrasena}
                    onChangeText={(texto) => {
                        setContrasena(texto);
                        ocultarAvisoCuentaCreada();
                    }}
                    error={errores.contrasena}
                    esContrasena
                    autoComplete="current-password"
                    textContentType="password"
                    returnKeyType="go"
                    onSubmitEditing={enviar}
                />

                <Boton titulo="Iniciar sesión" icono="siguiente" onPress={enviar} cargando={cargando} />
                {errorGeneral && <Aviso mensaje={errorGeneral} />}
            </View>

            <View style={styles.registro}>
                <Texto variante="cuerpo" color="textoSecundario">
                    ¿No tienes cuenta?
                </Texto>
                <Link href="/registro" accessibilityRole="link" style={styles.enlace}>
                    <Texto variante="cuerpo" color="primario" peso="700" style={styles.subrayado}>
                        Regístrate
                    </Texto>
                </Link>
            </View>

            {/* El espacio flexible empuja la barra al fondo cuando sobra pantalla;
          en pantallas pequeñas la barra simplemente se desplaza con el resto */}
            <View style={styles.espacioFlexible} />
            <BarraAccesibilidad />
        </FondoPantalla>
    );
}

const styles = StyleSheet.create({
    encabezado: {
        alignItems: 'center',
        gap: Espacio.l,
        marginTop: Espacio.l,
        marginBottom: Espacio.xl,
    },
    titulos: {
        gap: Espacio.xs,
    },
    tarjeta: {
        borderRadius: Radio.l,
        borderWidth: 2,
        padding: Espacio.xl,
        gap: Espacio.l,
    },
    sombra: {
        boxShadow: '0px 12px 24px rgba(31, 58, 107, 0.08)',
    },
    registro: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: Espacio.xs,
        marginTop: Espacio.xl,
        marginBottom: Espacio.l,
    },
    espacioFlexible: {
        flexGrow: 1,
    },
    enlace: {
        paddingVertical: Espacio.s,
    },
    subrayado: {
        textDecorationLine: 'underline',
    },
});