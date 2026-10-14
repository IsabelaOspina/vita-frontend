import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { accionesComunesVoz, salir } from '@/components/vita/acciones-cuenta';
import { ElementoLista } from '@/components/vita/elemento-lista';
import { Encabezado } from '@/components/vita/encabezado';
import { EstadoCarga } from '@/components/vita/estado-carga';
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

/** Pestaña "Mis pacientes" del personal de salud: los pacientes que tiene asignados. */
export default function MisPacientesScreen() {
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

    /** Abre los síntomas de un paciente (solo consulta). */
    const abrir = (p: AsignacionResponse) =>
        router.push({ pathname: '/personal/paciente/[id]', params: { id: String(p.pacienteId), nombre: p.pacienteNombre } });

    useComandosPantalla({
        titulo: 'Mis pacientes',
        descripcion:
            'Mis pacientes. Aquí están los pacientes que tienes asignados; toca uno para ver sus síntomas. ' +
            'Puedes decir: mis pacientes, abre a un paciente por su nombre, mi cuenta o cerrar sesión.',
        ejemplos: ['mis pacientes', ...(pacientes[0] ? [`abre a ${primerNombre(pacientes[0].pacienteNombre)}`] : []), 'mi cuenta', 'cerrar sesión'],
        campos: [],
        listas: [
            {
                claves: ['mis pacientes', 'pacientes', 'lee la lista', 'lista', 'a quien atiendo'],
                nombre: 'Tus pacientes',
                vacia: 'Todavía no tienes pacientes asignados.',
                elementos: pacientes.map((p) => ({ nombre: p.pacienteNombre, detalle: `asignado el ${fechaLarga(p.fechaAsignacion)}` })),
                acciones: [
                    {
                        frases: ['abre', 'abrir', 'ver', 'muestra', 'sintomas de', 'los sintomas de', 'ver sintomas de', 'como esta'],
                        ejecutar: (i) => abrir(pacientes[i]),
                    },
                ],
            },
        ],
        acciones: accionesComunesVoz('PERSONAL_SALUD', anunciar),
    });

    return (
        <FondoPantalla>
            <Encabezado
                alCerrarSesion={() => salir(anunciar)}
                icono="medico"
                titulo={perfil ? `¡Hola, ${primerNombre(perfil.nombre)}!` : '¡Hola!'}
                subtitulo={perfil?.personalSalud?.especialidad ?? 'Personal de salud'}
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
                        <ElementoLista
                            key={p.id}
                            titulo={p.pacienteNombre}
                            lineas={[`Asignado el ${fechaLarga(p.fechaAsignacion)}`]}
                            onPress={() => abrir(p)}
                            descripcionPress={`Ver los síntomas de ${p.pacienteNombre}`}
                        />
                    ))}
                </View>
            </Tarjeta>
        </FondoPantalla>
    );
}

const styles = StyleSheet.create({
    lista: {
        gap: Espacio.m,
    },
});