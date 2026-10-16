import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Espacio, Radio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';
import { useComandosPantalla } from '@/context/asistente-context';
import { deFechaLocal, horaCorta } from '@/utils/fechas';
import { mensajeDeError } from '@/utils/sesion';
import { enumerar, nombreTipoActividad, sinPuntoDoble, tomaPorMarcar } from '@/utils/salud';

import { accionesComunesVoz, salir } from './acciones-cuenta';
import { Boton } from './boton';
import { Encabezado } from './encabezado';
import { FondoPantalla } from './fondo-pantalla';
import { Icono, type NombreIcono } from './icono';
import { datosDeHoy } from './pantalla-hoy';
import { Tarjeta } from './tarjeta';
import { Texto } from './texto';

type Resumen = { tomasPendientes: string[]; actividades: string[]; medicamentosActivos: number };

/** Un acceso grande del menú. */
function Acceso({ icono, titulo, detalle, color, fondo, onPress }: { icono: NombreIcono; titulo: string; detalle: string; color: string; fondo: string; onPress: () => void }) {
    const { colores } = useAccesibilidad();
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={`${titulo}. ${detalle}`}
            style={({ pressed }) => [styles.acceso, { backgroundColor: pressed ? colores.superficieSuave : colores.superficie, borderColor: colores.borde }]}>
            <View style={[styles.iconoAcceso, { backgroundColor: fondo }]}>
                <Icono nombre={icono} tamano={28} color={color} />
            </View>
            <View style={styles.textos}>
                <Texto variante="subtitulo" peso="800">
                    {titulo}
                </Texto>
                <Texto variante="pequeno" color="textoSecundario">
                    {detalle}
                </Texto>
            </View>
            <Icono nombre="siguiente" tamano={24} color={colores.textoTenue} />
        </Pressable>
    );
}

/**
 * Pestaña "Mi salud": resumen de hoy y tres accesos grandes (Agenda, Medicamentos y Síntomas).
 */
export function PantallaMiSalud() {
    const { anunciar, colores } = useAccesibilidad();
    const [resumen, setResumen] = useState<Resumen | null>(null);
    const [error, setError] = useState<string | null>(null);

    const cargar = useCallback(async () => {
        setError(null);
        try {
            const datos = await datosDeHoy();
            setResumen({
                tomasPendientes: datos.tomas.filter(tomaPorMarcar).map((t) => `${t.medicamentoNombre} a las ${horaCorta(deFechaLocal(t.fechaHora))}`),
                actividades: datos.actividades
                    .filter((a) => a.estado === 'PENDIENTE')
                    .map((a) => `${nombreTipoActividad(a.tipo).toLowerCase()} a las ${horaCorta(deFechaLocal(a.fechaHora))}`),
                medicamentosActivos: datos.medicamentosActivos,
            });
        } catch (e) {
            setError(mensajeDeError(e, 'No pudimos cargar el resumen de hoy.'));
        }
    }, []);

    const cargarRef = useRef(cargar);
    cargarRef.current = cargar;
    useFocusEffect(
        useCallback(() => {
            void cargarRef.current();
        }, []),
    );

    const fraseHoy = !resumen
        ? error ?? 'Cargando lo de hoy…'
        : resumen.tomasPendientes.length === 0 && resumen.actividades.length === 0
            ? 'Hoy no tienes tomas ni actividades pendientes.'
            : [
            resumen.tomasPendientes.length
                ? `Te ${resumen.tomasPendientes.length === 1 ? 'falta 1 toma' : `faltan ${resumen.tomasPendientes.length} tomas`}: ${enumerar(resumen.tomasPendientes)}`
                : 'No te faltan tomas',
            resumen.actividades.length ? `Tienes ${enumerar(resumen.actividades)}` : 'No tienes actividades pendientes',
        ].join('. ') + '.';
    const fraseHoyLimpia = sinPuntoDoble(fraseHoy);

    useComandosPantalla({
        cargando: !resumen && !error,
        titulo: 'Mi salud',
        descripcion: `Mi salud. ${fraseHoyLimpia} Puedes decir: qué tengo hoy, agenda, medicamentos o síntomas.`,
        ejemplos: ['qué tengo hoy', 'agenda', 'medicamentos', 'síntomas'],
        campos: [],
        acciones: [
            { frases: ['lee el resumen', 'resumen', 'como voy hoy'], etiqueta: 'leer el resumen de hoy', ejecutar: () => anunciar(fraseHoyLimpia) },
            ...accionesComunesVoz('USUARIO', anunciar),
        ],
    });

    return (
        <FondoPantalla>
            <Encabezado alCerrarSesion={() => salir(anunciar)} icono="salud" titulo="Mi salud" subtitulo="Agenda, medicamentos y síntomas" />

            <Tarjeta titulo="Hoy" icono="hoy">
                <Texto variante="cuerpo" color={error ? 'error' : 'textoSecundario'} accessibilityLiveRegion="polite">
                    {fraseHoyLimpia}
                </Texto>
                <Boton titulo="Ver lo de hoy" icono="siguiente" onPress={() => router.push('/paciente/salud/hoy')} />
            </Tarjeta>

            <View style={styles.accesos}>
                <Acceso
                    icono="calendario"
                    titulo="Agenda"
                    detalle="Citas, terapias y recordatorios"
                    color={colores.calendario.icono}
                    fondo={colores.calendario.fondo}
                    onPress={() => router.push('/paciente/salud/agenda')}
                />
                <Acceso
                    icono="medicamento"
                    titulo="Medicamentos"
                    detalle={
                        resumen
                            ? `${resumen.medicamentosActivos === 1 ? '1 activo' : `${resumen.medicamentosActivos} activos`} · horarios y tomas`
                            : 'Horarios y tomas'
                    }
                    color={colores.exito}
                    fondo={colores.exitoFondo}
                    onPress={() => router.push('/paciente/salud/medicamentos')}
                />
                <Acceso
                    icono="sintomas"
                    titulo="Síntomas"
                    detalle="Registro, historial y evolución"
                    color={colores.sintomas.icono}
                    fondo={colores.sintomas.fondo}
                    onPress={() => router.push('/paciente/salud/sintomas')}
                />
            </View>
        </FondoPantalla>
    );
}

const styles = StyleSheet.create({
    accesos: {
        gap: Espacio.m,
    },
    acceso: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Espacio.m,
        padding: Espacio.l,
        borderRadius: Radio.l,
        borderWidth: 1.5,
        minHeight: 88,
    },
    iconoAcceso: {
        width: 56,
        height: 56,
        borderRadius: Radio.m,
        alignItems: 'center',
        justifyContent: 'center',
    },
    textos: {
        flex: 1,
        gap: 2,
    },
});