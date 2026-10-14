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
import { Texto } from '@/components/vita/texto';
import { Espacio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';
import { useComandosPantalla } from '@/context/asistente-context';
import type { AsignacionResponse } from '@/dto/AsignacionResponse';
import { consultarMisPacientes } from '@/services/personalSaludService';
import { obtenerMiUsuario } from '@/services/usuarioService';
import { mensajeDeError, tokenActual, type Cuenta } from '@/utils/sesion';
import { fechaLarga, primerNombre } from '@/utils/textos';

/** Pantalla principal del personal de salud: los pacientes que tiene asignados. */
export default function PersonalScreen() {
    const { anunciar } = useAccesibilidad();

    const [perfil, setPerfil] = useState<Cuenta | null>(null);
    const [pacientes, setPacientes] = useState<AsignacionResponse[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const cargar = useCallback(async () => {
        setCargando(true);
        setError(null);
        try {
            const token = await tokenActual();
            const [yo, mios] = await Promise.all([obtenerMiUsuario(token), consultarMisPacientes()]);
            setPerfil(yo);
            setPacientes(mios);
        } catch (e) {
            setError(mensajeDeError(e, 'No pudimos cargar tus pacientes.'));
        } finally {
            setCargando(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            void cargar();
        }, [cargar]),
    );

    const datosProfesionales = perfil?.personalSalud;

    useComandosPantalla({
        titulo: 'Mis pacientes',
        descripcion:
            'Mis pacientes. Aquí están los pacientes que tienes asignados. ' +
            'Puedes decir: mis pacientes, mis datos, cambiar contraseña o cerrar sesión.',
        ejemplos: ['mis pacientes', 'mis datos', 'cambiar contraseña', 'cerrar sesión'],
        campos: [],
        listas: [
            {
                claves: ['mis pacientes', 'pacientes', 'lee la lista', 'lista', 'a quien atiendo'],
                nombre: 'Tus pacientes',
                vacia: 'Todavía no tienes pacientes asignados.',
                elementos: pacientes.map((p) => ({ nombre: p.pacienteNombre, detalle: `asignado el ${fechaLarga(p.fechaAsignacion)}` })),
            },
        ],
        acciones: [
            {
                frases: ['mis datos', 'mi perfil', 'mi informacion', 'lee mis datos'],
                ejecutar: () =>
                    anunciar(
                        perfil
                            ? [
                                `Tus datos. Nombre: ${perfil.nombre}`,
                                datosProfesionales ? `Especialidad: ${datosProfesionales.especialidad}` : '',
                                datosProfesionales ? `Registro profesional: ${datosProfesionales.numeroRegistroProfesional}` : '',
                                `Correo: ${perfil.correo}`,
                            ]
                                .filter(Boolean)
                                .join('. ')
                            : 'Todavía estoy cargando tus datos.',
                    ),
            },
            ...accionesDeCuentaVoz(anunciar),
        ],
    });

    return (
        <FondoPantalla>
            <Encabezado
                icono="medico"
                titulo={perfil ? `¡Hola, ${primerNombre(perfil.nombre)}!` : '¡Hola!'}
                subtitulo={datosProfesionales?.especialidad ?? 'Personal de salud'}
            />

            <Tarjeta
                titulo="Mis pacientes"
                icono="pacientes"
                extra={
                    pacientes.length > 0 ? (
                        <Texto variante="subtitulo" color="primario" accessibilityLabel={`${pacientes.length} pacientes`}>
                            {pacientes.length}
                        </Texto>
                    ) : null
                }>
                <EstadoCarga
                    cargando={cargando}
                    error={error}
                    reintentar={cargar}
                    hayDatos={pacientes.length > 0}
                    vacio="Todavía no tienes pacientes asignados. El administrador te los asignará."
                />
                <View style={styles.lista}>
                    {pacientes.map((p) => (
                        <ElementoLista key={p.id} titulo={p.pacienteNombre} lineas={[`Asignado el ${fechaLarga(p.fechaAsignacion)}`]} />
                    ))}
                </View>
            </Tarjeta>

            {perfil && (
                <Tarjeta titulo="Mis datos" icono="persona">
                    <FilaDato etiqueta="Nombre" valor={perfil.nombre} icono="persona" />
                    {datosProfesionales && (
                        <>
                            <FilaDato etiqueta="Especialidad" valor={datosProfesionales.especialidad} icono="medico" />
                            <FilaDato etiqueta="Registro profesional" valor={datosProfesionales.numeroRegistroProfesional} icono="insignia" />
                        </>
                    )}
                    <FilaDato etiqueta="Correo electrónico" valor={perfil.correo} icono="correo" />
                    {perfil.telefono ? <FilaDato etiqueta="Teléfono" valor={perfil.telefono} icono="telefono" /> : null}
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