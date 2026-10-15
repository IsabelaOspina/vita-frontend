import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';

import { accionesComunesVoz, salir } from '@/components/vita/acciones-cuenta';
import { Aviso } from '@/components/vita/aviso';
import { Boton } from '@/components/vita/boton';
import { Campo, NotaCamposObligatorios } from '@/components/vita/campo';
import { Encabezado } from '@/components/vita/encabezado';
import { FondoPantalla } from '@/components/vita/fondo-pantalla';
import { Tarjeta } from '@/components/vita/tarjeta';
import { Espacio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';
import { useComandosPantalla } from '@/context/asistente-context';
import { crearPersonal } from '@/services/adminUsuarioService';
import { mensajeDeError, tokenActual } from '@/utils/sesion';
import { campoDelError } from '@/utils/textos';

type Errores = Partial<Record<'nombre' | 'cedula' | 'correo' | 'telefono' | 'especialidad' | 'registro' | 'contrasena', string>>;

function validar(d: {
    nombre: string;
    cedula: string;
    correo: string;
    telefono: string;
    especialidad: string;
    registro: string;
    contrasena: string;
}): Errores {
    const errores: Errores = {};
    if (!d.nombre.trim()) errores.nombre = 'Escribe el nombre completo';
    if (!d.cedula.trim()) errores.cedula = 'Escribe el número de cédula';
    if (!d.correo.trim()) errores.correo = 'Escribe el correo';
    else if (!/^[^\s@]+@[^\s@]+$/.test(d.correo.trim())) errores.correo = 'Revisa el correo, parece incompleto';
    if (!d.especialidad.trim()) errores.especialidad = 'Escribe la especialidad';
    else if (d.especialidad.trim().length > 100) errores.especialidad = 'La especialidad admite máximo 100 caracteres';
    if (!d.registro.trim()) errores.registro = 'Escribe el número de registro profesional';
    else if (d.registro.trim().length > 50) errores.registro = 'El número de registro admite máximo 50 caracteres';
    if (d.contrasena.length < 8) errores.contrasena = 'La contraseña debe tener al menos 8 caracteres';
    return errores;
}

/** El administrador registra un profesional de la salud (la cuenta se crea con rol PERSONAL_SALUD). */
export default function NuevoPersonalScreen() {
    const { anunciar } = useAccesibilidad();

    const [nombre, setNombre] = useState('');
    const [cedula, setCedula] = useState('');
    const [correo, setCorreo] = useState('');
    const [telefono, setTelefono] = useState('');
    const [especialidad, setEspecialidad] = useState('');
    const [registro, setRegistro] = useState('');
    const [contrasena, setContrasena] = useState('');
    const [errores, setErrores] = useState<Errores>({});
    const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
    const [cargando, setCargando] = useState(false);

    const cedulaRef = useRef<TextInput>(null);
    const correoRef = useRef<TextInput>(null);
    const telefonoRef = useRef<TextInput>(null);
    const especialidadRef = useRef<TextInput>(null);
    const registroRef = useRef<TextInput>(null);
    const contrasenaRef = useRef<TextInput>(null);

    // Es una pestaña: "Cancelar" lleva a la pestaña de cuentas
    const volver = () => router.navigate('/admin');

    const registrar = async () => {
        const encontrados = validar({ nombre, cedula, correo, telefono, especialidad, registro, contrasena });
        setErrores(encontrados);
        setErrorGeneral(null);
        if (Object.keys(encontrados).length > 0) {
            anunciar(`Revisa el formulario. ${Object.values(encontrados).join('. ')}`);
            return;
        }

        setCargando(true);
        try {
            // El rol no se envía: el backend siempre crea la cuenta como PERSONAL_SALUD
            const creado = await crearPersonal(
                {
                    nombre: nombre.trim(),
                    cedula: cedula.trim(),
                    correo: correo.trim(),
                    contrasena,
                    telefono: telefono.trim() || undefined,
                    especialidad: especialidad.trim(),
                    numeroRegistroProfesional: registro.trim(),
                },
                await tokenActual(),
            );
            anunciar(`Listo. ${creado.nombre} quedó registrado como profesional de salud.`);
            // Vuelve al panel, que muestra el aviso de éxito
            // Se limpia el formulario (la pestaña sigue abierta) y se vuelve a las cuentas con el aviso de éxito
            setNombre('');
            setCedula('');
            setCorreo('');
            setTelefono('');
            setEspecialidad('');
            setRegistro('');
            setContrasena('');
            router.navigate({ pathname: '/admin', params: { creado: creado.nombre } });
        } catch (e) {
            const mensaje = mensajeDeError(e, 'No pudimos registrar al profesional.');
            // El error va debajo del campo que lo causó; si no es de un campo, debajo del botón
            const campo = campoDelError<keyof Errores>(mensaje, [
                [/correo/i, 'correo'],
                [/c[eé]dula/i, 'cedula'],
                [/registro/i, 'registro'],
                [/especialidad/i, 'especialidad'],
                [/contrase/i, 'contrasena'],
                [/tel[eé]fono/i, 'telefono'],
                [/nombre/i, 'nombre'],
            ]);
            if (campo) setErrores({ [campo]: mensaje });
            else setErrorGeneral(mensaje);
            anunciar(mensaje);
        } finally {
            setCargando(false);
        }
    };

    useComandosPantalla({
        titulo: 'Registrar profesional de salud',
        descripcion:
            'Registrar profesional de salud. Llena el nombre, la cédula, el correo, la especialidad, ' +
            'el número de registro profesional y una contraseña temporal. El teléfono no es obligatorio.',
        ejemplos: [
            'el nombre es Laura Restrepo',
            'la especialidad es cardiología',
            'el registro es RM 1 2 3 4',
            'registrar',
        ],
        campos: [
            {
                claves: ['nombre completo', 'nombre del profesional', 'nombre'],
                etiqueta: 'Nombre completo',
                pregunta: '¿Cuál es el nombre completo del profesional?',
                tipo: 'nombre',
                valor: nombre,
                asignar: setNombre,
            },
            {
                claves: ['numero de cedula', 'cedula', 'documento'],
                etiqueta: 'Cédula',
                pregunta: '¿Cuál es su número de cédula?',
                tipo: 'numero',
                valor: cedula,
                asignar: setCedula,
            },
            {
                claves: ['correo electronico', 'correo', 'email', 'mail'],
                etiqueta: 'Correo electrónico',
                pregunta: '¿Cuál es su correo electrónico?',
                tipo: 'correo',
                valor: correo,
                asignar: setCorreo,
            },
            {
                claves: ['especialidad', 'area'],
                etiqueta: 'Especialidad',
                pregunta: '¿Cuál es su especialidad? Por ejemplo: medicina general, psicología o fisioterapia.',
                tipo: 'texto',
                valor: especialidad,
                asignar: setEspecialidad,
            },
            {
                claves: ['numero de registro profesional', 'registro profesional', 'numero de registro', 'registro', 'tarjeta profesional'],
                etiqueta: 'Número de registro profesional',
                pregunta: '¿Cuál es su número de registro profesional?',
                tipo: 'texto',
                valor: registro,
                // "TP 4 4 5 5 6" → "TP 44556": se juntan los números dictados uno por uno
                asignar: (valor) => setRegistro(valor.toUpperCase().replace(/(?<=\d)\s+(?=\d)/g, '')),
            },
            {
                claves: ['contrasena temporal', 'contrasena', 'clave'],
                etiqueta: 'Contraseña temporal',
                pregunta: '¿Qué contraseña temporal le pongo? Debe tener al menos 8 caracteres.',
                tipo: 'contrasena',
                valor: contrasena,
                asignar: setContrasena,
            },
            {
                claves: ['telefono', 'celular', 'numero de telefono'],
                etiqueta: 'Teléfono',
                pregunta: '¿Cuál es su teléfono?',
                tipo: 'numero',
                valor: telefono,
                asignar: setTelefono,
                opcional: true,
            },
        ],
        pasosOpcionales: [{ pregunta: 'Responde sí o no: ¿quieres agregar su teléfono?', campos: ['Teléfono'] }],
        acciones: [
            { frases: ['registrar', 'guardar', 'crear', 'terminar', 'enviar'], etiqueta: 'registrar al profesional', ejecutar: registrar },
            { frases: ['volver', 'atras', 'regresar', 'no registrar', 've a cuentas', 'ir a cuentas'], ejecutar: volver },
            ...accionesComunesVoz('ADMIN', anunciar),
        ],
    });

    return (
        <FondoPantalla>
            <Encabezado
                alCerrarSesion={() => salir(anunciar)}
                icono="personaAgregar"
                titulo="Registrar profesional"
                subtitulo="La cuenta se crea con el rol de personal de salud."
            />


            <Tarjeta titulo="Datos personales" icono="persona">
                <Campo
                    etiqueta="Nombre completo"
                    obligatorio
                    icono="persona"
                    placeholder="Ej: Laura Restrepo"
                    value={nombre}
                    onChangeText={setNombre}
                    error={errores.nombre}
                    autoCapitalize="words"
                    returnKeyType="next"
                    onSubmitEditing={() => cedulaRef.current?.focus()}
                />
                <Campo
                    ref={cedulaRef}
                    etiqueta="Cédula"
                    obligatorio
                    icono="cedula"
                    placeholder="Ej: 1094123456"
                    value={cedula}
                    onChangeText={setCedula}
                    error={errores.cedula}
                    returnKeyType="next"
                    onSubmitEditing={() => correoRef.current?.focus()}
                />
                <Campo
                    ref={correoRef}
                    etiqueta="Correo electrónico"
                    obligatorio
                    icono="correo"
                    placeholder="correo@ejemplo.com"
                    value={correo}
                    onChangeText={setCorreo}
                    error={errores.correo}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    returnKeyType="next"
                    onSubmitEditing={() => telefonoRef.current?.focus()}
                />
                <Campo
                    ref={telefonoRef}
                    etiqueta="Teléfono"
                    icono="telefono"
                    placeholder="Ej: 3001234567"
                    value={telefono}
                    onChangeText={setTelefono}
                    error={errores.telefono}
                    keyboardType="phone-pad"
                    returnKeyType="next"
                    onSubmitEditing={() => especialidadRef.current?.focus()}
                />
            </Tarjeta>

            <Tarjeta titulo="Datos profesionales" icono="medico">
                <Campo
                    ref={especialidadRef}
                    etiqueta="Especialidad"
                    obligatorio
                    icono="medico"
                    placeholder="Ej: Medicina general"
                    value={especialidad}
                    onChangeText={setEspecialidad}
                    error={errores.especialidad}
                    autoCapitalize="sentences"
                    returnKeyType="next"
                    onSubmitEditing={() => registroRef.current?.focus()}
                />
                <Campo
                    ref={registroRef}
                    etiqueta="Número de registro profesional"
                    obligatorio
                    icono="insignia"
                    placeholder="Ej: RM-10234"
                    value={registro}
                    onChangeText={setRegistro}
                    error={errores.registro}
                    autoCapitalize="characters"
                    returnKeyType="next"
                    onSubmitEditing={() => contrasenaRef.current?.focus()}
                />
            </Tarjeta>

            <Tarjeta titulo="Acceso" icono="candado">
                <Campo
                    ref={contrasenaRef}
                    etiqueta="Contraseña temporal"
                    obligatorio
                    icono="candado"
                    placeholder="Mínimo 8 caracteres"
                    ayuda="El profesional podrá cambiarla después de iniciar sesión."
                    value={contrasena}
                    onChangeText={setContrasena}
                    error={errores.contrasena}
                    esContrasena
                    returnKeyType="go"
                    onSubmitEditing={registrar}
                />
            </Tarjeta>

            <View style={styles.botones}>
                <NotaCamposObligatorios />
                <Boton titulo="Registrar profesional" icono="check" onPress={registrar} cargando={cargando} />
                {errorGeneral && <Aviso mensaje={errorGeneral} />}
                <Boton titulo="Cancelar" variante="secundario" onPress={volver} />
            </View>
        </FondoPantalla>
    );
}

const styles = StyleSheet.create({
    aviso: {
        marginBottom: Espacio.l,
    },
    botones: {
        gap: Espacio.m,
        marginBottom: Espacio.xl,
    },
});