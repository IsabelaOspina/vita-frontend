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
import { useComandosPantalla } from '@/context/asistente-context';
import type { TipoDiscapacidad } from '@/dto/TipoDiscapacidad';
import type { ContactoEmergenciaRequest } from '@/dto/ContactoEmergenciaRequest';
import type { UsuarioRequest } from '@/dto/UsuarioRequest';
import { ApiError } from '@/services/api';
import { registrarUsuario } from '@/services/usuarioService';

const DISCAPACIDADES: { tipo: TipoDiscapacidad; titulo: string; icono: NombreIcono }[] = [
    { tipo: 'VISUAL', titulo: 'Visual', icono: 'visual' },
    { tipo: 'AUDITIVA', titulo: 'Auditiva', icono: 'auditiva' },
    { tipo: 'COGNITIVA', titulo: 'Cognitiva', icono: 'cognitiva' },
    { tipo: 'DEL_HABLA', titulo: 'Del habla', icono: 'habla' },
];

const TITULO_CONTACTO = 'Contacto de emergencia';
const EXPLICACION_CONTACTO =
    'Es opcional. Es la persona a quien avisaremos si pides ayuda de emergencia. ' +
    'Si lo agregas, el nombre y el teléfono son obligatorios.';

const PREGUNTA_DISCAPACIDAD = '¿Tienes alguna discapacidad?';
const EXPLICACION_DISCAPACIDAD =
    'Es opcional. Nos ayuda a adaptar VITA para ti: tamaño de letra, contraste, avisos por voz y más.';

/** Convierte cualquier error en un mensaje entendible para el usuario. */
function mensajeDeError(e: unknown): string {
    // El backend respondió con un error (por ejemplo "Ya existe un usuario con ese correo")
    if (e instanceof ApiError) return e.message;
    // No hubo respuesta: el servidor está apagado, la IP del .env está mal o no hay internet
    return 'No pudimos conectarnos con el servidor. Revisa tu conexión e intenta de nuevo.';
}

type Errores = Partial<
    Record<'nombre' | 'cedula' | 'correo' | 'contrasena' | 'contactoNombre' | 'contactoTelefono', string>
>;

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

/** El contacto es opcional: si se llena algún campo, nombre y teléfono pasan a ser obligatorios (igual que en el backend). */
function validarContacto(c: ContactoEmergenciaRequest): Errores {
    const errores: Errores = {};
    const seLleno = [c.nombre, c.telefono, c.parentesco].some((v) => v?.trim());
    if (!seLleno) return errores;
    if (!c.nombre.trim()) errores.contactoNombre = 'Escribe el nombre de tu contacto';
    if (!c.telefono.trim()) errores.contactoTelefono = 'Escribe el teléfono de tu contacto';
    else if (!/^\d{7,15}$/.test(c.telefono.trim())) errores.contactoTelefono = 'El teléfono debe tener solo números (mínimo 7)';
    return errores;
}

export default function RegistroScreen() {
    const { colores, altoContraste, anunciar, leer } = useAccesibilidad();

    const [nombre, setNombre] = useState('');
    const [cedula, setCedula] = useState('');
    const [correo, setCorreo] = useState('');
    const [contrasena, setContrasena] = useState('');
    const [contactoNombre, setContactoNombre] = useState('');
    const [contactoTelefono, setContactoTelefono] = useState('');
    const [contactoParentesco, setContactoParentesco] = useState('');
    const [discapacidades, setDiscapacidades] = useState<TipoDiscapacidad[]>([]);
    const [errores, setErrores] = useState<Errores>({});
    const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
    const [cargando, setCargando] = useState(false);

    const cedulaRef = useRef<TextInput>(null);
    const correoRef = useRef<TextInput>(null);
    const contrasenaRef = useRef<TextInput>(null);
    const contactoTelefonoRef = useRef<TextInput>(null);
    const contactoParentescoRef = useRef<TextInput>(null);

    const alternarDiscapacidad = (tipo: TipoDiscapacidad, titulo: string) => {
        const quedaSeleccionada = !discapacidades.includes(tipo);
        setDiscapacidades((actuales) =>
            actuales.includes(tipo) ? actuales.filter((t) => t !== tipo) : [...actuales, tipo],
        );
        // Con modo voz, confirma qué opción se tocó y cómo quedó
        leer(`Discapacidad ${titulo.toLowerCase()}, ${quedaSeleccionada ? 'seleccionada' : 'quitada'}. Es opcional.`);
    };

    const volver = () => (router.canGoBack() ? router.back() : router.replace('/login'));

    /** Marca o quita una discapacidad sin hablar (el asistente da su propia confirmación). */
    const cambiarDiscapacidad = (tipo: TipoDiscapacidad, marcar: boolean) => {
        setDiscapacidades((actuales) =>
            marcar ? (actuales.includes(tipo) ? actuales : [...actuales, tipo]) : actuales.filter((t) => t !== tipo),
        );
    };

    const enviar = async () => {
        const contacto: ContactoEmergenciaRequest = {
            nombre: contactoNombre.trim(),
            telefono: contactoTelefono.trim(),
            parentesco: contactoParentesco.trim() || undefined,
        };
        const hayContacto = Boolean(contacto.nombre || contacto.telefono || contacto.parentesco);
        const encontrados = { ...validar({ nombre, cedula, correo, contrasena }), ...validarContacto(contacto) };
        setErrores(encontrados);
        setErrorGeneral(null);
        if (Object.keys(encontrados).length > 0) {
            // Se leen los errores concretos, no solo un aviso general
            anunciar(`Revisa el formulario. ${Object.values(encontrados).join('. ')}`);
            return;
        }

        setCargando(true);
        try {
            await registrarUsuario({
                nombre: nombre.trim(),
                cedula: cedula.trim(),
                correo: correo.trim(),
                contrasena,
                // Si la sección de contacto quedó vacía, no se envía
                contactoEmergencia: hayContacto ? contacto : undefined,
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
        },
        !altoContraste && styles.sombra,
    ];

    // Lo que el asistente "Oye VITA" puede hacer en esta pantalla
    useComandosPantalla({
        titulo: 'Crear cuenta',
        descripcion:
            'Crear cuenta. Llena tu nombre completo, cédula, correo y una contraseña. ' +
            'Después puedes agregar un contacto de emergencia e indicar si tienes alguna discapacidad.',
        ejemplos: [
            'mi nombre es María Gómez y mi cédula es 1 0 9 4',
            'mi correo es maría arroba gmail punto com y mi contraseña es girasol 2026',
            'el nombre del contacto es Ana',
            'teléfono del contacto 300 123 4567',
            'quiero agregar un contacto de emergencia',
            'tengo discapacidad visual',
            'crear cuenta',
        ],
        campos: [
            {
                claves: ['nombre completo', 'mi nombre', 'nombre'],
                etiqueta: 'Nombre completo',
                pregunta: '¿Cuál es tu nombre completo?',
                tipo: 'nombre',
                valor: nombre,
                asignar: setNombre,
            },
            {
                claves: ['numero de cedula', 'cedula', 'documento'],
                etiqueta: 'Cédula',
                pregunta: '¿Cuál es tu número de cédula?',
                tipo: 'numero',
                valor: cedula,
                asignar: setCedula,
            },
            {
                claves: ['correo electronico', 'correo', 'email', 'mail'],
                etiqueta: 'Correo electrónico',
                pregunta: '¿Cuál es tu correo electrónico?',
                tipo: 'correo',
                valor: correo,
                asignar: setCorreo,
            },
            {
                claves: ['contrasena', 'clave'],
                etiqueta: 'Contraseña',
                pregunta: '¿Qué contraseña quieres? Debe tener al menos 8 caracteres.',
                tipo: 'contrasena',
                valor: contrasena,
                asignar: setContrasena,
            },
            {
                claves: [
                    'nombre del contacto de emergencia',
                    'nombre de contacto de emergencia',
                    'nombre de mi contacto de emergencia',
                    'nombre de mi contacto',
                    'nombre del contacto',
                    'nombre de contacto',
                    'contacto de emergencia',
                    'contacto',
                ],
                etiqueta: 'Nombre del contacto',
                pregunta: '¿Cómo se llama tu contacto de emergencia?',
                tipo: 'nombre',
                valor: contactoNombre,
                asignar: setContactoNombre,
                opcional: true,
            },
            {
                claves: [
                    'telefono del contacto de emergencia',
                    'telefono de mi contacto',
                    'telefono del contacto',
                    'telefono de contacto',
                    'celular del contacto',
                    'numero del contacto',
                    'telefono',
                    'celular',
                ],
                etiqueta: 'Teléfono del contacto',
                pregunta: '¿Cuál es el teléfono de tu contacto?',
                tipo: 'numero',
                valor: contactoTelefono,
                asignar: setContactoTelefono,
                opcional: true,
            },
            {
                claves: ['parentesco', 'relacion'],
                etiqueta: 'Parentesco',
                pregunta: '¿Qué parentesco tiene contigo? Por ejemplo: mamá, hermano o amiga.',
                tipo: 'texto',
                valor: contactoParentesco,
                asignar: setContactoParentesco,
                opcional: true,
            },
        ],
        opciones: DISCAPACIDADES.map((d) => ({
            claves: d.tipo === 'DEL_HABLA' ? ['del habla', 'habla'] : [d.titulo.toLowerCase()],
            etiqueta: `Discapacidad ${d.titulo.toLowerCase()}`,
            marcada: discapacidades.includes(d.tipo),
            cambiar: (marcar: boolean) => cambiarDiscapacidad(d.tipo, marcar),
        })),
        // Al terminar los datos obligatorios, el asistente ofrece los opcionales antes de crear la cuenta
        pasosOpcionales: [
            {
                pregunta: 'Ya tengo tus datos principales. Responde sí o no: ¿quieres agregar un contacto de emergencia?',
                campos: ['Nombre del contacto', 'Teléfono del contacto', 'Parentesco'],
            },
            {
                pregunta: 'Responde sí o no: ¿quieres contarnos si tienes alguna discapacidad?',
                siAcepta: '¿Cuál? Puedes decir visual, auditiva, cognitiva o del habla. Puedes decir varias.',
                opciones: true,
            },
        ],
        acciones: [
            { frases: ['crear cuenta', 'crear mi cuenta', 'registrarme', 'enviar', 'terminar'], etiqueta: 'crear la cuenta', ejecutar: enviar },
            { frases: ['iniciar sesion', 'ya tengo cuenta', 'ir al inicio de sesion'], ejecutar: () => router.replace('/login') },
            { frases: ['volver', 'atras', 'regresar'], ejecutar: volver },
        ],
    });

    return (
        <FondoPantalla>
            <View style={styles.barraSuperior}>
                <Pressable
                    onPress={volver}
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
                    {/* Al tocar el título, el modo voz lee el título y la explicación */}
                    <Pressable
                        onPress={() => leer(`${TITULO_CONTACTO}. ${EXPLICACION_CONTACTO}`)}
                        accessibilityRole="header"
                        style={styles.tituloSeccion}>
                        <View style={styles.filaTitulo}>
                            <Icono nombre="contactoEmergencia" tamano={24} color={colores.primario} />
                            <Texto variante="subtitulo" style={styles.textoTitulo}>
                                {TITULO_CONTACTO}
                            </Texto>
                        </View>
                        <Texto variante="pequeno" color="textoSecundario">
                            {EXPLICACION_CONTACTO}
                        </Texto>
                    </Pressable>

                    <Campo
                        etiqueta="Nombre del contacto"
                        icono="persona"
                        placeholder="Ej: Ana Gómez"
                        value={contactoNombre}
                        onChangeText={setContactoNombre}
                        error={errores.contactoNombre}
                        autoCapitalize="words"
                        returnKeyType="next"
                        onSubmitEditing={() => contactoTelefonoRef.current?.focus()}
                    />
                    <Campo
                        ref={contactoTelefonoRef}
                        etiqueta="Teléfono del contacto"
                        icono="telefono"
                        placeholder="Ej: 3001234567"
                        value={contactoTelefono}
                        onChangeText={(texto) => setContactoTelefono(texto.replace(/\D/g, ''))}
                        error={errores.contactoTelefono}
                        keyboardType="phone-pad"
                        textContentType="telephoneNumber"
                        maxLength={15}
                        returnKeyType="next"
                        onSubmitEditing={() => contactoParentescoRef.current?.focus()}
                    />
                    <Campo
                        ref={contactoParentescoRef}
                        etiqueta="Parentesco (opcional)"
                        icono="parentesco"
                        placeholder="Ej: Mamá, hermano, pareja"
                        ayuda="Qué relación tiene contigo"
                        value={contactoParentesco}
                        onChangeText={setContactoParentesco}
                        autoCapitalize="sentences"
                        returnKeyType="done"
                    />
                </View>

                <View style={estiloTarjeta}>
                    {/* Al tocar el título, el modo voz lee la pregunta y la explicación */}
                    <Pressable
                        onPress={() => leer(`${PREGUNTA_DISCAPACIDAD} ${EXPLICACION_DISCAPACIDAD}`)}
                        accessibilityRole="header"
                        style={styles.tituloSeccion}>
                        <Texto variante="subtitulo">{PREGUNTA_DISCAPACIDAD}</Texto>
                        <Texto variante="pequeno" color="textoSecundario">
                            {EXPLICACION_DISCAPACIDAD}
                        </Texto>
                    </Pressable>

                    <View style={styles.chips}>
                        {DISCAPACIDADES.map((d) => (
                            <ChipSeleccion
                                key={d.tipo}
                                titulo={d.titulo}
                                icono={d.icono}
                                seleccionado={discapacidades.includes(d.tipo)}
                                onPress={() => alternarDiscapacidad(d.tipo, d.titulo)}
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
        boxShadow: '0px 12px 24px rgba(31, 58, 107, 0.08)',
    },
    filaTitulo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Espacio.s,
    },
    textoTitulo: {
        flexShrink: 1,
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