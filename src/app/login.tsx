import { Link, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
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

/**
 * TEMPORAL: simula la llamada al backend para poder probar la pantalla.
 * Reemplazar por el servicio de autenticación (POST /api/auth/login),
 * que debe guardar el token y devolver los datos del usuario.
 * Si el backend responde error, lanzar un Error con el "mensaje" que trae la respuesta.
 */
async function iniciarSesionTemporal(correo: string, _contrasena: string): Promise<{ nombre: string }> {
    await new Promise((resolver) => setTimeout(resolver, 900));
    return { nombre: correo.split('@')[0] };
}

type Errores = { correo?: string; contrasena?: string };

function validar(correo: string, contrasena: string): Errores {
    const errores: Errores = {};
    if (!correo.trim()) errores.correo = 'Escribe tu correo';
    else if (!/^\S+@\S+\.\S+$/.test(correo.trim())) errores.correo = 'Revisa el correo, parece incompleto';
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
    const [bienvenida, setBienvenida] = useState<string | null>(null);
    const [cargando, setCargando] = useState(false);
    const contrasenaRef = useRef<TextInput>(null);

    const enviar = async () => {
        const encontrados = validar(correo, contrasena);
        setErrores(encontrados);
        setErrorGeneral(null);
        setBienvenida(null);
        if (Object.keys(encontrados).length > 0) {
            anunciar('Revisa los datos del formulario');
            return;
        }

        setCargando(true);
        try {
            const usuario = await iniciarSesionTemporal(correo.trim(), contrasena);
            // TODO: cuando exista el panel principal, navegar a él en lugar de mostrar este mensaje
            const mensaje = `¡Bienvenido, ${usuario.nombre}! Iniciaste sesión correctamente.`;
            setBienvenida(mensaje);
            anunciar(mensaje);
        } catch (e) {
            const mensaje = e instanceof Error ? e.message : 'No pudimos iniciar sesión. Intenta de nuevo.';
            setErrorGeneral(mensaje);
            anunciar(mensaje);
        } finally {
            setCargando(false);
        }
    };

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
                        shadowColor: colores.sombra,
                    },
                    !altoContraste && styles.sombra,
                ]}>
                {bienvenida && <Aviso tipo="exito" mensaje={bienvenida} />}
                {params.registrado === '1' && !errorGeneral && !bienvenida && (
                    <Aviso tipo="exito" mensaje="¡Tu cuenta fue creada! Ahora inicia sesión." />
                )}
                {errorGeneral && <Aviso mensaje={errorGeneral} />}

                <Campo
                    etiqueta="Correo electrónico"
                    icono="correo"
                    placeholder="tucorreo@ejemplo.com"
                    value={correo}
                    onChangeText={setCorreo}
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
                    onChangeText={setContrasena}
                    error={errores.contrasena}
                    esContrasena
                    autoComplete="current-password"
                    textContentType="password"
                    returnKeyType="go"
                    onSubmitEditing={enviar}
                />

                <Boton titulo="Iniciar sesión" icono="siguiente" onPress={enviar} cargando={cargando} />
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
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.08,
        shadowRadius: 24,
        elevation: 4,
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