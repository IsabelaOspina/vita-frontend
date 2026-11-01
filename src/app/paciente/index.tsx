import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { accionesComunesVoz, salir } from '@/components/vita/acciones-cuenta';
import { ElementoLista } from '@/components/vita/elemento-lista';
import { Encabezado } from '@/components/vita/encabezado';
import { EstadoCarga } from '@/components/vita/estado-carga';
import { FondoPantalla } from '@/components/vita/fondo-pantalla';
import { Icono } from '@/components/vita/icono';
import { Tarjeta } from '@/components/vita/tarjeta';
import { Texto } from '@/components/vita/texto';
import { Espacio, Radio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';
import { useAsistente, useComandosPantalla } from '@/context/asistente-context';
import type { AsignacionResponse } from '@/dto/AsignacionResponse';
import { obtenerMiUsuario, obtenerMisProfesionales } from '@/services/usuarioService';
import { mensajeDeError, tokenActual, type Cuenta } from '@/utils/sesion';
import { fechaLarga, primerNombre } from '@/utils/textos';

/** Pestaña "Inicio" del paciente (rol USUARIO): sus profesionales de salud. */
export default function InicioPacienteScreen() {
    const { anunciar, colores } = useAccesibilidad();
    const { escuchaEmergenciaActiva } = useAsistente();

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
            'Inicio. Aquí están tus profesionales de salud y el botón para pedir ayuda. ' +
            'Puedes decir: emergencia médica o tuve un accidente para avisar a tu contacto de emergencia, mis profesionales, mi cuenta o cerrar sesión.',
        ejemplos: ['emergencia médica', 'tuve un accidente', 'pedir ayuda', 'mis profesionales', 'mi cuenta', 'cerrar sesión'],
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

            {/* Pedir ayuda: lo primero que se ve, grande y en rojo */}
            <Pressable
                onPress={() => router.push('/paciente/emergencia')}
                accessibilityRole="button"
                accessibilityLabel="Pedir ayuda de emergencia"
                accessibilityHint={
                    perfil?.contactoEmergencia
                        ? `Le enviaremos un mensaje de texto a ${perfil.contactoEmergencia.nombre}`
                        : 'Primero tendrás que registrar tu contacto de emergencia'
                }
                style={({ pressed }) => [styles.ayuda, { backgroundColor: colores.error, opacity: pressed ? 0.85 : 1 }]}>
                <View style={[styles.ayudaIcono, { backgroundColor: colores.sobrePrimario }]}>
                    <Icono nombre="emergencia" tamano={34} color={colores.error} />
                </View>
                <View style={styles.ayudaTextos}>
                    <Texto variante="subtitulo" peso="800" style={{ color: colores.sobrePrimario }}>
                        Pedir ayuda
                    </Texto>
                    <Texto variante="pequeno" style={{ color: colores.sobrePrimario }}>
                        {perfil?.contactoEmergencia
                            ? `Avisaremos a ${perfil.contactoEmergencia.nombre} por mensaje de texto`
                            : perfil
                                ? 'Registra tu contacto de emergencia para usarlo'
                                : 'Emergencia médica, accidente u otra'}
                    </Texto>
                    {escuchaEmergenciaActiva && (
                        <Texto variante="pequeno" peso="700" style={{ color: colores.sobrePrimario }}>
                            También puedes decir: «pedir ayuda»
                        </Texto>
                    )}
                </View>
            </Pressable>

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
    ayuda: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Espacio.l,
        minHeight: 88,
        borderRadius: Radio.l,
        padding: Espacio.l,
        marginBottom: Espacio.l,
        boxShadow: '0px 10px 20px rgba(194, 40, 58, 0.28)',
    },
    ayudaIcono: {
        width: 56,
        height: 56,
        borderRadius: Radio.total,
        alignItems: 'center',
        justifyContent: 'center',
    },
    ayudaTextos: {
        flex: 1,
        gap: 2,
    },
});