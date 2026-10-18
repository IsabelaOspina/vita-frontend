import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Boton } from '@/components/vita/boton';
import { FondoPantalla } from '@/components/vita/fondo-pantalla';
import { LogoVita } from '@/components/vita/logo-vita';
import { Texto } from '@/components/vita/texto';
import { Espacio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';
import { ApiError } from '@/services/api';
import { obtenerMiUsuario } from '@/services/usuarioService';
import { rutaDeInicio } from '@/utils/sesion';
import { eliminarToken, obtenerToken } from '@/utils/tokenStorage';

/**
 * Punto de entrada de la app. Si hay una sesión guardada en el celular y el token sigue vigente,
 * entra directo a la pantalla de su rol (paciente, personal de salud o administrador), sin volver
 * a pedir el correo y la contraseña. Si no hay sesión, o el token venció, va al inicio de sesión.
 */
export default function Index() {
    const { colores } = useAccesibilidad();
    const [sinConexion, setSinConexion] = useState(false);

    const entrar = useCallback(async () => {
        setSinConexion(false);
        const token = await obtenerToken();
        if (!token) {
            router.replace('/login');
            return;
        }
        try {
            // Se confirma con el backend que el token sigue siendo válido y de qué rol es la cuenta
            const usuario = await obtenerMiUsuario(token);
            router.replace(rutaDeInicio(usuario.rol));
        } catch (e) {
            if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
                // La sesión venció o la cuenta fue desactivada: se borra y se vuelve a iniciar sesión
                await eliminarToken();
                router.replace('/login');
            } else {
                // Sin internet o el servidor no respondió: no se borra la sesión, se puede reintentar
                setSinConexion(true);
            }
        }
    }, []);

    useEffect(() => {
        void entrar();
    }, [entrar]);

    return (
        <FondoPantalla>
            <View style={styles.centro}>
                <LogoVita />
                {sinConexion ? (
                    <View style={styles.mensaje} accessibilityLiveRegion="polite">
                        <Texto variante="subtitulo" centrado>
                            No pudimos conectarnos
                        </Texto>
                        <Texto variante="cuerpo" color="textoSecundario" centrado>
                            Revisa tu conexión a internet e intenta de nuevo. Tu sesión sigue guardada.
                        </Texto>
                        <Boton titulo="Reintentar" icono="recargar" onPress={() => void entrar()} />
                        <Boton titulo="Ir al inicio de sesión" variante="secundario" onPress={() => router.replace('/login')} />
                    </View>
                ) : (
                    <View style={styles.mensaje} accessible accessibilityLabel="Abriendo VITA">
                        <ActivityIndicator color={colores.primario} size="large" />
                        <Texto variante="etiqueta" color="textoSecundario" centrado>
                            Abriendo VITA…
                        </Texto>
                    </View>
                )}
            </View>
        </FondoPantalla>
    );
}

const styles = StyleSheet.create({
    centro: {
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: Espacio.xl,
        paddingVertical: Espacio.xxl,
    },
    mensaje: {
        alignSelf: 'stretch',
        alignItems: 'center',
        gap: Espacio.m,
    },
});