import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { useAccesibilidad } from '@/context/accesibilidad-context';
import { useComandosPantalla } from '@/context/asistente-context';
import type { Rol } from '@/dto/Rol';
import { obtenerMiUsuario } from '@/services/usuarioService';
import { mensajeDeError, tokenActual, type Cuenta } from '@/utils/sesion';
import { nombreDiscapacidad, nombreRol } from '@/utils/textos';

import { accionesComunesVoz, salir } from './acciones-cuenta';
import { Boton } from './boton';
import { Encabezado } from './encabezado';
import { EstadoCarga } from './estado-carga';
import { FilaDato } from './fila-dato';
import { FondoPantalla } from './fondo-pantalla';
import type { NombreIcono } from './icono';
import { Tarjeta } from './tarjeta';

/** Los datos que se muestran (y se leen en voz alta) de la cuenta, según el rol. */
function datosDe(cuenta: Cuenta): { etiqueta: string; valor: string; icono: NombreIcono }[] {
    const contacto = cuenta.contactoEmergencia;
    return [
        { etiqueta: 'Nombre', valor: cuenta.nombre, icono: 'persona' },
        { etiqueta: 'Rol', valor: nombreRol(cuenta.rol), icono: 'insignia' },
        { etiqueta: 'Cédula', valor: cuenta.cedula, icono: 'cedula' },
        { etiqueta: 'Correo electrónico', valor: cuenta.correo, icono: 'correo' },
        ...(cuenta.telefono ? [{ etiqueta: 'Teléfono', valor: cuenta.telefono, icono: 'telefono' as const }] : []),
        ...(cuenta.personalSalud
            ? [
                { etiqueta: 'Especialidad', valor: cuenta.personalSalud.especialidad, icono: 'medico' as const },
                { etiqueta: 'Registro profesional', valor: cuenta.personalSalud.numeroRegistroProfesional, icono: 'insignia' as const },
            ]
            : []),
        ...(cuenta.rol === 'USUARIO'
            ? [
                {
                    etiqueta: 'Contacto de emergencia',
                    valor: contacto
                        ? `${contacto.nombre}${contacto.parentesco ? ` (${contacto.parentesco})` : ''}, ${contacto.telefono}`
                        : 'No registrado',
                    icono: 'contactoEmergencia' as const,
                },
                {
                    etiqueta: 'Discapacidad',
                    valor: cuenta.discapacidades.length
                        ? cuenta.discapacidades.map((d) => nombreDiscapacidad(d.tipo)).join(', ')
                        : 'No registrada',
                    icono: 'corazon' as const,
                },
            ]
            : []),
    ];
}

/** Pestaña "Mi cuenta" (igual para todos los roles): datos de la cuenta, cambiar contraseña y cerrar sesión. */
export function PantallaMiCuenta({ rol }: { rol: Rol }) {
    const { anunciar } = useAccesibilidad();

    const [cuenta, setCuenta] = useState<Cuenta | null>(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const cargar = useCallback(async () => {
        setCargando(true);
        setError(null);
        try {
            setCuenta(await obtenerMiUsuario(await tokenActual()));
        } catch (e) {
            setError(mensajeDeError(e, 'No pudimos cargar tus datos.'));
        } finally {
            setCargando(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            void cargar();
        }, [cargar]),
    );

    const datos = cuenta ? datosDe(cuenta) : [];

    useComandosPantalla({
        titulo: 'Mi cuenta',
        descripcion: 'Mi cuenta. Puedes decir: lee mis datos, cambiar contraseña o cerrar sesión.',
        ejemplos: ['lee mis datos', 'cambiar contraseña', 'cerrar sesión'],
        campos: [],
        acciones: [
            {
                frases: ['lee mis datos', 'mis datos', 'mi perfil', 'mi informacion', 'quien soy', 'datos'],
                ejecutar: () =>
                    anunciar(cuenta ? ['Tus datos', ...datos.map((d) => `${d.etiqueta}: ${d.valor}`)].join('. ') : 'Todavía estoy cargando tus datos.'),
            },
            ...accionesComunesVoz(rol, anunciar),
        ],
    });

    return (
        <FondoPantalla>
            <Encabezado alCerrarSesion={() => salir(anunciar)} icono="persona" titulo="Mi cuenta" subtitulo={cuenta?.nombre} />

            <EstadoCarga cargando={cargando} error={error} reintentar={cargar} hayDatos={!!cuenta} />

            {cuenta && (
                <Tarjeta titulo="Mis datos" icono="persona">
                    {datos.map((d) => (
                        <FilaDato key={d.etiqueta} {...d} />
                    ))}
                </Tarjeta>
            )}

            <Tarjeta titulo="Seguridad" icono="candado">
                <Boton titulo="Cambiar contraseña" icono="llave" variante="secundario" onPress={() => router.push('/cambiar-contrasena')} />
                <Boton titulo="Cerrar sesión" icono="salir" variante="secundario" onPress={() => salir(anunciar)} />
            </Tarjeta>
        </FondoPantalla>
    );
}