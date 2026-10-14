import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AccionesCuenta, accionesDeCuentaVoz } from '@/components/vita/acciones-cuenta';
import { BarraAccesibilidad } from '@/components/vita/barra-accesibilidad';
import { ElementoLista } from '@/components/vita/elemento-lista';
import { Encabezado } from '@/components/vita/encabezado';
import { EstadoCarga } from '@/components/vita/estado-carga';
import { FilaDato } from '@/components/vita/fila-dato';
import { FondoPantalla } from '@/components/vita/fondo-pantalla';
import { Tarjeta } from '@/components/vita/tarjeta';
import { Espacio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';
import { useComandosPantalla } from '@/context/asistente-context';
import type { AsignacionResponse } from '@/dto/AsignacionResponse';
import { obtenerMiUsuario, obtenerMisProfesionales } from '@/services/usuarioService';
import { mensajeDeError, tokenActual, type Cuenta } from '@/utils/sesion';
import { fechaLarga, nombreDiscapacidad, primerNombre } from '@/utils/textos';

/** Pantalla principal del paciente (rol USUARIO): sus profesionales de salud y sus datos. */
export default function InicioScreen() {
    const { anunciar } = useAccesibilidad();

    const [perfil, setPerfil] = useState<Cuenta | null>(null);
    const [profesionales, setProfesionales] = useState<AsignacionResponse[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const cargar = useCallback(async () => {
        setCargando(true);
        setError(null);
        try {
            const token = await tokenActual();
            const [yo, mios] = await Promise.all([obtenerMiUsuario(token), obtenerMisProfesionales(token)]);
            setPerfil(yo);
            setProfesionales(mios);
        } catch (e) {
            setError(mensajeDeError(e, 'No pudimos cargar tu información.'));
        } finally {
            setCargando(false);
        }
    }, []);

    // Se recarga cada vez que se vuelve a esta pantalla
    useFocusEffect(
        useCallback(() => {
            void cargar();
        }, [cargar]),
    );

    const contacto = perfil?.contactoEmergencia;
    const datos = perfil
        ? [
            { etiqueta: 'Cédula', valor: perfil.cedula, icono: 'cedula' as const },
            { etiqueta: 'Correo electrónico', valor: perfil.correo, icono: 'correo' as const },
            ...(perfil.telefono ? [{ etiqueta: 'Teléfono', valor: perfil.telefono, icono: 'telefono' as const }] : []),
            {
                etiqueta: 'Contacto de emergencia',
                valor: contacto
                    ? `${contacto.nombre}${contacto.parentesco ? ` (${contacto.parentesco})` : ''}, ${contacto.telefono}`
                    : 'No registrado',
                icono: 'contactoEmergencia' as const,
            },
            {
                etiqueta: 'Discapacidad',
                valor: perfil.discapacidades.length
                    ? perfil.discapacidades.map((d) => nombreDiscapacidad(d.tipo)).join(', ')
                    : 'No registrada',
                icono: 'corazon' as const,
            },
        ]
        : [];

    // Lo que el asistente "Oye VITA" puede hacer en esta pantalla
    useComandosPantalla({
        titulo: 'Inicio',
        descripcion:
            'Inicio. Aquí están tus profesionales de salud y tus datos. ' +
            'Puedes decir: mis profesionales, mis datos, cambiar contraseña o cerrar sesión.',
        ejemplos: ['mis profesionales', 'mis datos', 'cambiar contraseña', 'cerrar sesión'],
        campos: [],
        listas: [
            {
                claves: ['mis profesionales', 'profesionales', 'mis medicos', 'medicos', 'doctores', 'quien me atiende'],
                nombre: 'Tus profesionales de salud',
                vacia: 'Todavía no tienes profesionales de salud asignados.',
                elementos: profesionales.map((p) => ({ nombre: p.profesionalNombre, detalle: p.especialidad })),
            },
        ],
        acciones: [
            {
                frases: ['mis datos', 'mi perfil', 'mi informacion', 'lee mis datos', 'quien soy'],
                ejecutar: () =>
                    anunciar(perfil ? [`Tus datos. Nombre: ${perfil.nombre}`, ...datos.map((d) => `${d.etiqueta}: ${d.valor}`)].join('. ') : 'Todavía estoy cargando tus datos.'),
            },
            ...accionesDeCuentaVoz(anunciar),
        ],
    });

    return (
        <FondoPantalla>
            <Encabezado
                icono="saludo"
                titulo={perfil ? `¡Hola, ${primerNombre(perfil.nombre)}!` : '¡Hola!'}
                subtitulo="Qué bueno verte. Aquí está tu información."
            />

            <Tarjeta titulo="Mis profesionales de salud" icono="medico">
                <EstadoCarga
                    cargando={cargando}
                    error={error}
                    reintentar={cargar}
                    hayDatos={profesionales.length > 0}
                    vacio="Todavía no tienes profesionales de salud asignados. El administrador te los asignará."
                />
                <View style={styles.lista}>
                    {profesionales.map((p) => (
                        <ElementoLista
                            key={p.id}
                            titulo={p.profesionalNombre}
                            lineas={[p.especialidad, `Registro profesional ${p.numeroRegistroProfesional}`, `Te atiende desde el ${fechaLarga(p.fechaAsignacion)}`]}
                        />
                    ))}
                </View>
            </Tarjeta>

            {perfil && (
                <Tarjeta titulo="Mis datos" icono="persona">
                    {datos.map((d) => (
                        <FilaDato key={d.etiqueta} {...d} />
                    ))}
                </Tarjeta>
            )}

            <AccionesCuenta anunciar={anunciar} />
            <View style={styles.espacioFlexible} />
            <BarraAccesibilidad />
        </FondoPantalla>
    );
}

const styles = StyleSheet.create({
    lista: {
        gap: Espacio.m,
    },
    espacioFlexible: {
        flexGrow: 1,
    },
});