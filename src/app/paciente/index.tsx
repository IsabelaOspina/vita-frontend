import { useFocusEffect } from 'expo-router';
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
import { obtenerMiUsuario, obtenerMisProfesionales } from '@/services/usuarioService';
import { mensajeDeError, tokenActual, type Cuenta } from '@/utils/sesion';
import { fechaLarga, primerNombre } from '@/utils/textos';

/** Pestaña "Inicio" del paciente (rol USUARIO): sus profesionales de salud. */
export default function InicioPacienteScreen() {
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

    // Se recarga cada vez que se vuelve a esta pestaña
    useFocusEffect(
        useCallback(() => {
            void cargar();
        }, [cargar]),
    );

    // Lo que el asistente "Oye VITA" puede hacer en esta pantalla
    useComandosPantalla({
        titulo: 'Inicio',
        descripcion:
            'Inicio. Aquí están tus profesionales de salud. ' +
            'Puedes decir: mis profesionales, mi cuenta, accesibilidad o cerrar sesión.',
        ejemplos: ['mis profesionales', 'mi cuenta', 'accesibilidad', 'cerrar sesión'],
        campos: [],
        listas: [
            {
                claves: ['mis profesionales', 'profesionales', 'mis medicos', 'medicos', 'doctores', 'quien me atiende'],
                nombre: 'Tus profesionales de salud',
                vacia: 'Todavía no tienes profesionales de salud asignados.',
                elementos: profesionales.map((p) => ({ nombre: p.profesionalNombre, detalle: p.especialidad })),
            },
        ],
        acciones: accionesComunesVoz('USUARIO', anunciar),
    });

    return (
        <FondoPantalla>
            <Encabezado
                alCerrarSesion={() => salir(anunciar)}
                icono="saludo"
                titulo={perfil ? `¡Hola, ${primerNombre(perfil.nombre)}!` : '¡Hola!'}
                subtitulo="Qué bueno verte."
            />

            <Tarjeta
                titulo="Mis profesionales de salud"
                icono="medico"
                extra={
                    profesionales.length > 0 ? (
                        <Texto variante="subtitulo" color="primario" accessibilityLabel={`${profesionales.length} profesionales`}>
                            {profesionales.length}
                        </Texto>
                    ) : null
                }>
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
        </FondoPantalla>
    );
}

const styles = StyleSheet.create({
    lista: {
        gap: Espacio.m,
    },
});