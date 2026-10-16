import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Espacio, Radio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';
import { useComandosPantalla } from '@/context/asistente-context';
import { deFechaLocal, horaCorta } from '@/utils/fechas';
import { mensajeDeError } from '@/utils/sesion';
import { actividadVigente, enumerar, nombreTipoActividad, sinPuntoDoble, tomaPorMarcar, tomaVigente } from '@/utils/salud';
import { contarRecomendacionesNoLeidas } from '@/services/recomendacionService';

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
function Acceso({
    icono,
    titulo,
    detalle,
    color,
    fondo,
    insignia,
    onPress,
}: {
    icono: NombreIcono;
    titulo: string;
    detalle: string;
    color: string;
    fondo: string;
    /** Número destacado (por ejemplo, recomendaciones nuevas). */
    insignia?: number;
    onPress: () => void;
}) {
    const { colores } = useAccesibilidad();
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={`${titulo}. ${detalle}`}
            style={({ pressed }) => [styles.acceso, { backgroundColor: pressed ? colores.superficieSuave : colores.superficie, borderColor: colores.borde }]}
        >
            <View style={[styles.iconoAcceso, { backgroundColor: fondo }]}>
                <Icono nombre={icono} tamano={28} color={color} />
                {insignia ? (
                    <View
                        style={[styles.insignia, { backgroundColor: colores.error, borderColor: colores.superficie }]}
                        accessibilityElementsHidden
                        importantForAccessibility="no"
                    >
                        <Texto variante="pequeno" peso="800" style={{ color: '#FFFFFF' }}>
                            {insignia}
                        </Texto>
                    </View>
                ) : null}
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
 * Pestaña "Mi salud": resumen de lo que falta hoy y accesos grandes (Agenda, Medicamentos, Síntomas y Recomendaciones).
 */
export function PantallaMiSalud() {
    const { anunciar, colores } = useAccesibilidad();
    const [resumen, setResumen] = useState<Resumen | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [recomendacionesNuevas, setRecomendacionesNuevas] = useState(0);

    const cargar = useCallback(async () => {
        setError(null);
        // Las recomendaciones nuevas no deben impedir que se vea el resumen si fallan
        contarRecomendacionesNoLeidas()
            .then((r) => setRecomendacionesNuevas(r.cantidad))
            .catch(() => undefined);
        try {
            const datos = await datosDeHoy();
            const ahora = Date.now();
            // Solo lo que todavía viene (lo que ya pasó se ve en Hoy, en "Ya pasó hoy")
            setResumen({
                tomasPendientes: datos.tomas
                    .filter((t) => tomaPorMarcar(t) && tomaVigente(t, ahora))
                    .map((t) => `${t.medicamentoNombre} a las ${horaCorta(deFechaLocal(t.fechaHora))}`),
                actividades: datos.actividades
                    .filter((a) => a.estado === 'PENDIENTE' && actividadVigente(a, ahora))
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
        ? (error ?? 'Cargando lo de hoy…')
        : resumen.tomasPendientes.length === 0 && resumen.actividades.length === 0
          ? 'Por hoy no tienes más tomas ni actividades pendientes.'
          : [
                resumen.tomasPendientes.length
                    ? `Te ${resumen.tomasPendientes.length === 1 ? 'falta 1 toma' : `faltan ${resumen.tomasPendientes.length} tomas`}: ${enumerar(resumen.tomasPendientes)}`
                    : 'No te faltan tomas por hoy',
                resumen.actividades.length ? `Tienes ${enumerar(resumen.actividades)}` : 'No tienes más actividades hoy',
            ].join('. ') + '.';
    const fraseHoyLimpia = sinPuntoDoble(fraseHoy);

    useComandosPantalla({
        cargando: !resumen && !error,
        titulo: 'Mi salud',
        descripcion:
            `Mi salud. ${fraseHoyLimpia}` +
            (recomendacionesNuevas
                ? ` Tienes ${recomendacionesNuevas === 1 ? '1 recomendación nueva' : `${recomendacionesNuevas} recomendaciones nuevas`} de tu personal de salud.`
                : '') +
            ' Puedes decir: qué tengo hoy, agenda, medicamentos, síntomas o recomendaciones.',
        ejemplos: ['qué tengo hoy', 'agenda', 'medicamentos', 'síntomas', 'recomendaciones'],
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
                <Acceso
                    icono="medico"
                    titulo="Recomendaciones"
                    detalle={
                        recomendacionesNuevas
                            ? `${recomendacionesNuevas === 1 ? '1 nueva' : `${recomendacionesNuevas} nuevas`} de tu personal de salud`
                            : 'De tu personal de salud'
                    }
                    color={colores.primario}
                    fondo={colores.superficieSuave}
                    insignia={recomendacionesNuevas}
                    onPress={() => router.push('/paciente/salud/recomendaciones')}
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
    insignia: {
        position: 'absolute',
        top: -6,
        right: -6,
        minWidth: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        paddingHorizontal: 4,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
