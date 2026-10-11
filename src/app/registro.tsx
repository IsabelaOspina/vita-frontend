import { Link, router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type TextInput } from 'react-native';

import { Aviso } from '@/components/vita/aviso';
import { Boton } from '@/components/vita/boton';
import { Campo } from '@/components/vita/campo';
import { ChipSeleccion } from '@/components/vita/chip-seleccion';
import { FondoPantalla } from '@/components/vita/fondo-pantalla';
import { Icono, type NombreIcono } from '@/components/vita/icono';
import { Texto } from '@/components/vita/texto';
import { Espacio, Radio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';
import type { TipoDiscapacidad } from '@/dto/TipoDiscapacidad';
import type { UsuarioRequest } from '@/dto/UsuarioRequest';
import { ApiError } from '@/services/api';
import { registrarUsuario } from '@/services/usuarioService';

const DISCAPACIDADES: { tipo: TipoDiscapacidad; titulo: string; icono: NombreIcono }[] = [
    { tipo: 'VISUAL', titulo: 'Visual', icono: 'visual' },
    { tipo: 'AUDITIVA', titulo: 'Auditiva', icono: 'auditiva' },
    { tipo: 'COGNITIVA', titulo: 'Cognitiva', icono: 'cognitiva' },
    { tipo: 'DEL_HABLA', titulo: 'Del habla', icono: 'habla' },
];

/** Convierte cualquier error en un mensaje entendible para el usuario. */
function mensajeDeError(e: unknown): string {
    // El backend respondió con un error (por ejemplo "Ya existe un usuario con ese correo")
    if (e instanceof ApiError) return e.message;
    // No hubo respuesta: el servidor está apagado, la IP del .env está mal o no hay internet
    return 'No pudimos conectarnos con el servidor. Revisa tu conexión e intenta de nuevo.';
}

type Errores = Partial<Record<'nombre' | 'cedula' | 'correo' | 'contrasena', string>>;

function validar(d: Pick<UsuarioRequest, 'nombre' | 'cedula' | 'correo' | 'contrasena'>): Errores {
    const errores: Errores = {};
    if (!d.nombre.trim()) errores.nombre = 'Escribe tu nombre completo';
    if (!d.cedula.trim()) errores.cedula = 'Escribe tu número de cédula';
    else if (!/^\d{5,12}$/.test(d.cedula.trim())) errores.cedula = 'La cédula debe tener solo números';
    if (!d.correo.trim()) errores.correo = 'Escribe tu correo';
    else if (!/^\S+@\S+\.\S+$/.test(d.correo.trim())) errores.correo = 'Revisa el correo, parece incompleto';
    if (d.contrasena.length < 8) errores.contrasena = 'La contraseña debe tener al menos 8 caracteres';
    return errores;
}

export default function RegistroScreen() {
    const { colores, altoContraste, anunciar } = useAccesibilidad();

    const [nombre, setNombre] = useState('');
    const [cedula, setCedula] = useState('');
    const [correo, setCorreo] = useState('');
    const [contrasena, setContrasena] = useState('');
    const [discapacidades, setDiscapacidades] = useState<TipoDiscapacidad[]>([]);
    const [errores, setErrores] = useState<Errores>({});
    const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
    const [cargando, setCargando] = useState(false);

    const cedulaRef = useRef<TextInput>(null);
    const correoRef = useRef<TextInput>(null);
    const contrasenaRef = useRef<TextInput>(null);

    const alternarDiscapacidad = (tipo: TipoDiscapacidad) => {
        setDiscapacidades((actuales) =>
            actuales.includes(tipo) ? actuales.filter((t) => t !== tipo) : [...actuales, tipo],
        );
    };

    const enviar = async () => {
        const encontrados = validar({ nombre, cedula, correo, contrasena });
        setErrores(encontrados);
        setErrorGeneral(null);
        if (Object.keys(encontrados).length > 0) {
            anunciar('Revisa los datos marcados en el formulario');
            return;
        }

        setCargando(true);
        try {
            await registrarUsuario({
                nombre: nombre.trim(),
                cedula: cedula.trim(),
                correo: correo.trim(),
                contrasena,
                discapacidades: discapacidades.map((tipo) => ({ tipo })),
            });
            router.replace({ pathname: '/login', params: { correo: correo.trim(), registrado: '1' } });
        } catch (e) {
            const mensaje = mensajeDeError(e);
            setErrorGeneral(mensaje);
            anunciar(mensaje);
        } finally {
            setCargando(false);
        }
    };

    const estiloTarjeta = [
        styles.tarjeta,
        {
            backgroundColor: colores.superficie,
            borderColor: altoContraste ? colores.borde : 'transparent',
            shadowColor: colores.sombra,
        },
        !altoContraste && styles.sombra,
    ];

    return (
        <FondoPantalla>
            <View style={styles.barraSuperior}>
                <Pressable
                    onPress={() => (router.canGoBack() ? router.back() : router.replace('/login'))}
                    accessibilityRole="button"
                    accessibilityLabel="Volver"
                    hitSlop={8}
                    style={({ pressed }) => [
                        styles.botonVolver,
                        { backgroundColor: colores.superficie, borderColor: colores.borde },
                        pressed && { opacity: 0.7 },
                    ]}>
                    <Icono nombre="atras" tamano={24} color={colores.texto} />
                </Pressable>
            </View>

            <View style={styles.encabezado}>
                <View style={[styles.avatar, { backgroundColor: colores.superficieSuave, borderColor: colores.primario }]}>
                    <Icono nombre="personaAgregar" tamano={40} color={colores.primario} />
                </View>
                <Texto variante="titulo" centrado accessibilityRole="header">
                    Crear cuenta
                </Texto>
                <Texto variante="cuerpo" color="textoSecundario" centrado>
                    Solo te tomará un minuto
                </Texto>
            </View>

            <View style={styles.secciones}>
                {errorGeneral && <Aviso mensaje={errorGeneral} />}

                <View style={estiloTarjeta}>
                    <Texto variante="subtitulo" accessibilityRole="header">
                        Tus datos
                    </Texto>

                    <Campo
                        etiqueta="Nombre completo"
                        icono="persona"
                        placeholder="Ej: María Gómez"
                        value={nombre}
                        onChangeText={setNombre}
                        error={errores.nombre}
                        autoComplete="name"
                        textContentType="name"
                        autoCapitalize="words"
                        returnKeyType="next"
                        onSubmitEditing={() => cedulaRef.current?.focus()}
                    />
                    <Campo
                        ref={cedulaRef}
                        etiqueta="Cédula"
                        icono="cedula"
                        placeholder="Solo números"
                        value={cedula}
                        onChangeText={(texto) => setCedula(texto.replace(/\D/g, ''))}
                        error={errores.cedula}
                        keyboardType="number-pad"
                        maxLength={12}
                        returnKeyType="next"
                        onSubmitEditing={() => correoRef.current?.focus()}
                    />
                    <Campo
                        ref={correoRef}
                        etiqueta="Correo electrónico"
                        icono="correo"
                        placeholder="tucorreo@ejemplo.com"
                        ayuda="Lo usarás para iniciar sesión"
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
                        placeholder="Crea una contraseña"
                        ayuda="Mínimo 8 caracteres"
                        value={contrasena}
                        onChangeText={setContrasena}
                        error={errores.contrasena}
                        esContrasena
                        autoComplete="new-password"
                        textContentType="newPassword"
                        returnKeyType="done"
                    />
                </View>

                <View style={estiloTarjeta}>
                    <View style={styles.tituloSeccion}>
                        <Texto variante="subtitulo" accessibilityRole="header">
                            ¿Tienes alguna discapacidad?
                        </Texto>
                        <Texto variante="pequeno" color="textoSecundario">
                            Es opcional. Nos ayuda a adaptar VITA para ti: tamaño de letra, contraste, avisos por voz y más.
                        </Texto>
                    </View>

                    <View style={styles.chips}>
                        {DISCAPACIDADES.map((d) => (
                            <ChipSeleccion
                                key={d.tipo}
                                titulo={d.titulo}
                                icono={d.icono}
                                seleccionado={discapacidades.includes(d.tipo)}
                                onPress={() => alternarDiscapacidad(d.tipo)}
                            />
                        ))}
                    </View>
                </View>

                <Boton titulo="Crear cuenta" icono="check" onPress={enviar} cargando={cargando} />
            </View>

            <View style={styles.pie}>
                <Texto variante="cuerpo" color="textoSecundario">
                    ¿Ya tienes cuenta?
                </Texto>
                <Link href="/login" replace accessibilityRole="link" style={styles.enlace}>
                    <Texto variante="cuerpo" color="primario" peso="700" style={styles.subrayado}>
                        Iniciar sesión
                    </Texto>
                </Link>
            </View>
        </FondoPantalla>
    );
}

const styles = StyleSheet.create({
    barraSuperior: {
        flexDirection: 'row',
    },
    botonVolver: {
        width: 48,
        height: 48,
        borderRadius: Radio.total,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    encabezado: {
        alignItems: 'center',
        gap: Espacio.s,
        marginTop: Espacio.s,
        marginBottom: Espacio.xl,
    },
    avatar: {
        width: 84,
        height: 84,
        borderRadius: Radio.total,
        borderWidth: 2,
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Espacio.s,
    },
    secciones: {
        gap: Espacio.l,
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
    tituloSeccion: {
        gap: Espacio.xs,
    },
    chips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Espacio.m,
    },
    pie: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: Espacio.xs,
        marginTop: Espacio.xl,
        marginBottom: Espacio.l,
    },
    enlace: {
        paddingVertical: Espacio.s,
    },
    subrayado: {
        textDecorationLine: 'underline',
    },
});