import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';

import { Aviso } from '@/components/vita/aviso';
import { Boton } from '@/components/vita/boton';
import { Campo, NotaCamposObligatorios } from '@/components/vita/campo';
import { Encabezado } from '@/components/vita/encabezado';
import { FondoPantalla } from '@/components/vita/fondo-pantalla';
import { RequisitosContrasena } from '@/components/vita/requisitos-contrasena';
import { Tarjeta } from '@/components/vita/tarjeta';
import { Espacio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';
import { useComandosPantalla } from '@/context/asistente-context';
import { iniciarSesion } from '@/services/authService';
import { cambiarMiContrasena, obtenerMiUsuario } from '@/services/usuarioService';
import { errorPoliticaContrasena, REQUISITOS_CONTRASENA_VOZ } from '@/utils/politica-contrasena';
import { cerrarSesion, mensajeDeError, tokenActual } from '@/utils/sesion';
import { campoDelError } from '@/utils/textos';

type Errores = Partial<Record<'actual' | 'nueva' | 'confirmacion', string>>;

/**
 * Cambiar la contraseña de quien tiene la sesión iniciada (sirve para todos los roles).
 * La nueva debe cumplir la política del backend y ser diferente a la actual. Al cambiarla, el
 * backend invalida las sesiones abiertas; por eso aquí se vuelve a iniciar sesión sola con la
 * contraseña nueva y la persona sigue usando la app sin notarlo.
 */
export default function CambiarContrasenaScreen() {
    const { anunciar } = useAccesibilidad();

    const [actual, setActual] = useState('');
    const [nueva, setNueva] = useState('');
    const [confirmacion, setConfirmacion] = useState('');
    const [errores, setErrores] = useState<Errores>({});
    const [aviso, setAviso] = useState<{ tipo: 'exito' | 'error'; mensaje: string } | null>(null);
    const [cargando, setCargando] = useState(false);

    const nuevaRef = useRef<TextInput>(null);
    const confirmacionRef = useRef<TextInput>(null);

    const volver = () => (router.canGoBack() ? router.back() : router.replace('/'));

    const guardar = async () => {
        const encontrados: Errores = {};
        if (!actual) encontrados.actual = 'Escribe tu contraseña actual';
        const errorNueva = errorPoliticaContrasena(nueva, { vacia: 'Escribe tu nueva contraseña', actual: actual || undefined });
        if (errorNueva) encontrados.nueva = errorNueva;
        if (!encontrados.nueva && confirmacion !== nueva) encontrados.confirmacion = 'Las contraseñas no coinciden';
        setErrores(encontrados);
        setAviso(null);
        if (Object.keys(encontrados).length > 0) {
            anunciar(`Revisa el formulario. ${Object.values(encontrados).join('. ')}`);
            return;
        }

        setCargando(true);
        try {
            const token = await tokenActual();
            // El correo se toma antes del cambio: después, el token actual deja de servir
            const { correo } = await obtenerMiUsuario(token);
            await cambiarMiContrasena({ contrasenaActual: actual, contrasenaNueva: nueva }, token);
            try {
                // Nueva sesión con la contraseña nueva (guarda el token nuevo)
                await iniciarSesion({ correo, contrasena: nueva });
            } catch {
                const mensaje = 'Tu contraseña quedó cambiada. Por seguridad, vuelve a iniciar sesión con la nueva contraseña.';
                anunciar(mensaje);
                await cerrarSesion();
                return;
            }
            const mensaje = 'Listo, tu contraseña quedó cambiada.';
            setAviso({ tipo: 'exito', mensaje });
            setActual('');
            setNueva('');
            setConfirmacion('');
            anunciar(mensaje);
        } catch (e) {
            const mensaje = mensajeDeError(e, 'No pudimos cambiar la contraseña.');
            // El error va debajo del campo que lo causó; si no es de un campo, debajo del botón
            const campo = campoDelError<keyof Errores>(mensaje, [
                [/actual/i, 'actual'],
                [/nueva|diferente/i, 'nueva'],
            ]);
            if (campo) setErrores({ [campo]: mensaje });
            else setAviso({ tipo: 'error', mensaje });
            anunciar(mensaje);
        } finally {
            setCargando(false);
        }
    };

    useComandosPantalla({
        titulo: 'Cambiar contraseña',
        descripcion: 'Cambiar contraseña. Escribe tu contraseña actual, la nueva y repite la nueva para confirmarla.',
        ejemplos: ['mi contraseña actual es …', 'la nueva contraseña es …', 'guardar'],
        campos: [
            {
                claves: ['contrasena actual', 'clave actual', 'actual'],
                etiqueta: 'Contraseña actual',
                pregunta: '¿Cuál es tu contraseña actual?',
                tipo: 'contrasena',
                valor: actual,
                asignar: setActual,
            },
            {
                claves: ['nueva contrasena', 'contrasena nueva', 'clave nueva', 'nueva clave', 'nueva'],
                etiqueta: 'Nueva contraseña',
                pregunta: `¿Cuál quieres que sea tu nueva contraseña? ${REQUISITOS_CONTRASENA_VOZ} Y debe ser diferente a la actual.`,
                tipo: 'contrasena',
                valor: nueva,
                asignar: setNueva,
            },
            {
                claves: ['confirmar contrasena', 'confirmacion', 'confirma', 'repite la nueva', 'repetir contrasena', 'otra vez la nueva'],
                etiqueta: 'Confirmar contraseña',
                pregunta: 'Repite la nueva contraseña para confirmarla.',
                tipo: 'contrasena',
                valor: confirmacion,
                asignar: setConfirmacion,
            },
        ],
        acciones: [
            { frases: ['guardar', 'cambiar', 'confirmar cambio', 'listo', 'enviar'], etiqueta: 'guardar la nueva contraseña', ejecutar: guardar },
            { frases: ['volver', 'atras', 'regresar'], ejecutar: volver },
        ],
    });

    return (
        <FondoPantalla>
            <Encabezado volver titulo="Cambiar contraseña" subtitulo="Por tu seguridad, primero escribe la contraseña que usas hoy." />


            <Tarjeta>
                <Campo
                    etiqueta="Contraseña actual"
                    obligatorio
                    icono="candado"
                    placeholder="La que usas hoy"
                    value={actual}
                    onChangeText={setActual}
                    error={errores.actual}
                    esContrasena
                    autoComplete="current-password"
                    returnKeyType="next"
                    onSubmitEditing={() => nuevaRef.current?.focus()}
                />
                <Campo
                    ref={nuevaRef}
                    etiqueta="Nueva contraseña"
                    obligatorio
                    icono="llave"
                    placeholder="Crea una contraseña segura"
                    value={nueva}
                    onChangeText={setNueva}
                    error={errores.nueva}
                    esContrasena
                    autoComplete="new-password"
                    returnKeyType="next"
                    onSubmitEditing={() => confirmacionRef.current?.focus()}
                />
                <RequisitosContrasena valor={nueva} actual={actual} />
                <Campo
                    ref={confirmacionRef}
                    etiqueta="Confirmar contraseña"
                    obligatorio
                    icono="llave"
                    placeholder="Repite la nueva contraseña"
                    value={confirmacion}
                    onChangeText={setConfirmacion}
                    error={errores.confirmacion}
                    esContrasena
                    autoComplete="new-password"
                    returnKeyType="go"
                    onSubmitEditing={guardar}
                />
                <NotaCamposObligatorios />
                <Boton titulo="Guardar contraseña" icono="check" onPress={guardar} cargando={cargando} />
                {aviso && <Aviso tipo={aviso.tipo} mensaje={aviso.mensaje} />}
            </Tarjeta>
        </FondoPantalla>
    );
}

const styles = StyleSheet.create({
    aviso: {
        marginBottom: Espacio.l,
    },
});