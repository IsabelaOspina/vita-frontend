import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Espacio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';
import { useComandosPantalla } from '@/context/asistente-context';
import type { SintomaResponse } from '@/dto/SintomaResponse';
import { fechaHoraCorta, fechaHoraLarga } from '@/utils/fechas';
import { dejarAvisoPendiente, type FuenteSintomas } from '@/utils/fuente-sintomas';
import { mensajeDeError } from '@/utils/sesion';
import { nombreNivel } from '@/utils/sintomas';

import { accionesComunesVoz } from './acciones-cuenta';
import { Aviso } from './aviso';
import { Boton } from './boton';
import { Encabezado } from './encabezado';
import { EstadoCarga } from './estado-carga';
import { FilaDato } from './fila-dato';
import { FondoPantalla } from './fondo-pantalla';
import { coloresNivel, InsigniaIntensidad } from './insignia-intensidad';
import { Tarjeta } from './tarjeta';
import { Texto } from './texto';

type Props = {
    fuente: FuenteSintomas;
    id: number;
};

/**
 * Detalle de un síntoma. El paciente puede editarlo o eliminarlo (eliminar siempre se confirma);
 * el personal de salud solo lo consulta.
 */
export function PantallaDetalleSintoma({ fuente, id }: Props) {
    const { anunciar, leer, colores, altoContraste } = useAccesibilidad();

    const [sintoma, setSintoma] = useState<SintomaResponse | null>(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);
    /** Al tocar "Eliminar" se pide confirmar en la misma pantalla. */
    const [confirmando, setConfirmando] = useState(false);
    const [eliminando, setEliminando] = useState(false);
    const [errorEliminar, setErrorEliminar] = useState<string | null>(null);

    const volver = () => (router.canGoBack() ? router.back() : router.replace(fuente.rutas.lista));

    const cargar = useCallback(async () => {
        setCargando(true);
        setError(null);
        try {
            const datos = await fuente.obtener(id);
            setSintoma(datos);
            return datos;
        } catch (e) {
            setError(mensajeDeError(e, 'No pudimos cargar el síntoma.'));
            return null;
        } finally {
            setCargando(false);
        }
    }, [fuente, id]);

    // Al entrar (y al volver de editarlo) se carga y, con el modo voz, se lee el síntoma
    useFocusEffect(
        useCallback(() => {
            setConfirmando(false);
            void cargar().then((datos) => datos && leer(datos.textoLectura, true));
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [cargar]),
    );

    const eliminar = async () => {
        if (!sintoma || !fuente.eliminar) return;
        setEliminando(true);
        setErrorEliminar(null);
        try {
            await fuente.eliminar(sintoma.id);
            const mensaje = `Se eliminó el síntoma ${sintoma.tipo.toLowerCase()}, ${fechaHoraCorta(sintoma.fechaHora).toLowerCase()}`.replace(/\.?$/, '.');
            anunciar(mensaje);
            // Vuelve a la pantalla de donde vino (Mis síntomas o el historial), que muestra el aviso
            dejarAvisoPendiente(mensaje);
            if (router.canGoBack()) router.back();
            else router.replace(fuente.rutas.lista);
        } catch (e) {
            const mensaje = mensajeDeError(e, 'No pudimos eliminar el síntoma.');
            setErrorEliminar(mensaje);
            anunciar(mensaje);
        } finally {
            setEliminando(false);
            setConfirmando(false);
        }
    };

    const editar = () => fuente.rutas.editar && router.push(fuente.rutas.editar(id));
    const nivel = sintoma ? nombreNivel(sintoma.nivelIntensidad) : '';

    useComandosPantalla({
        titulo: 'Detalle del síntoma',
        descripcion: fuente.editable
            ? 'Detalle del síntoma. Puedes decir: lee el síntoma, editar o eliminar.'
            : 'Detalle del síntoma. Puedes decir: lee el síntoma o volver.',
        ejemplos: fuente.editable ? ['lee el síntoma', 'editar', 'cambia la intensidad', 'eliminar', 'volver'] : ['lee el síntoma', 'volver'],
        campos: [],
        acciones: [
            {
                frases: ['lee el sintoma', 'leer', 'lee', 'detalle', 'datos', 'que dice', 'repite el sintoma'],
                etiqueta: 'leer el síntoma',
                ejecutar: () => anunciar(sintoma ? sintoma.textoLectura : 'Todavía estoy cargando el síntoma.'),
            },
            ...(fuente.editable
                ? [
                    {
                        frases: ['editar', 'edita', 'editalo', 'cambiar', 'cambia', 'modificar', 'corregir'],
                        etiqueta: 'editar el síntoma',
                        ejecutar: editar,
                    },
                    {
                        frases: ['eliminar', 'elimina', 'eliminalo', 'borrar', 'borra', 'borralo', 'quitar'],
                        etiqueta: 'eliminar el síntoma',
                        confirmar: sintoma
                            ? `¿Seguro que quieres eliminar el síntoma ${sintoma.tipo.toLowerCase()}, ${fechaHoraCorta(sintoma.fechaHora).toLowerCase()}?`
                            : '¿Seguro que quieres eliminar este síntoma?',
                        ejecutar: () => void eliminar(),
                    },
                ]
                : [
                    // El profesional solo consulta: si pide modificar, se le explica
                    {
                        frases: ['eliminar', 'elimina', 'eliminalo', 'borrar', 'borra', 'editar', 'edita', 'cambiar', 'cambia', 'modificar'],
                        ejecutar: () => anunciar('Solo puedes consultar este síntoma. Solo el paciente puede editarlo o eliminarlo.'),
                    },
                ]),
            { frases: ['volver', 'atras', 'regresar', 'ir a la lista', 'historial'], ejecutar: volver },
            ...accionesComunesVoz(fuente.rol, anunciar),
        ],
    });

    return (
        <FondoPantalla>
            <Encabezado
                volver
                alVolver={volver}
                titulo={sintoma?.tipo ?? 'Síntoma'}
                subtitulo={sintoma ? fechaHoraCorta(sintoma.fechaHora) : undefined}
            />

            <EstadoCarga cargando={cargando} error={error} reintentar={cargar} hayDatos={!!sintoma} />

            {sintoma && (
                <>
                    <Tarjeta>
                        <View style={styles.intensidad}>
                            <InsigniaIntensidad intensidad={sintoma.intensidad} grande />
                            <Texto
                                variante="subtitulo"
                                style={{ color: coloresNivel(sintoma.nivelIntensidad, colores, altoContraste).color }}>
                                {nivel} · {sintoma.intensidad} de 10
                            </Texto>
                        </View>
                    </Tarjeta>

                    <Tarjeta titulo="Datos" icono="info">
                        <FilaDato etiqueta="Síntoma" valor={sintoma.tipo} icono="sintomas" />
                        <FilaDato etiqueta="Cuándo" valor={fechaHoraLarga(sintoma.fechaHora)} icono="reloj" />
                        <FilaDato etiqueta="Observaciones" valor={sintoma.observaciones ?? 'Sin observaciones'} icono="nota" />
                        <Texto variante="pequeno" color="textoTenue">
                            Registrado: {fechaHoraCorta(sintoma.fechaRegistro)}
                            {sintoma.fechaActualizacion ? ` · Editado: ${fechaHoraCorta(sintoma.fechaActualizacion)}` : ''}
                        </Texto>
                    </Tarjeta>

                    {fuente.editable && (
                        <View style={styles.botones}>
                            <Boton titulo="Editar" icono="editar" variante="secundario" onPress={editar} />
                            {confirmando ? (
                                <View
                                    style={[styles.confirmar, { borderColor: colores.error, backgroundColor: colores.errorFondo }]}
                                    accessibilityLiveRegion="assertive">
                                    <Texto variante="etiqueta" color="error">
                                        ¿Seguro que quieres eliminar este síntoma? No se puede deshacer.
                                    </Texto>
                                    <Boton titulo="Sí, eliminar" icono="eliminar" variante="peligro" onPress={eliminar} cargando={eliminando} />
                                    <Boton titulo="No, conservarlo" variante="secundario" onPress={() => setConfirmando(false)} />
                                </View>
                            ) : (
                                <Boton
                                    titulo="Eliminar"
                                    icono="eliminar"
                                    variante="secundario"
                                    onPress={() => {
                                        setConfirmando(true);
                                        anunciar('¿Seguro que quieres eliminar este síntoma? Toca: sí, eliminar.');
                                    }}
                                />
                            )}
                            {errorEliminar && <Aviso mensaje={errorEliminar} />}
                        </View>
                    )}
                </>
            )}
        </FondoPantalla>
    );
}

const styles = StyleSheet.create({
    intensidad: {
        alignItems: 'center',
        gap: Espacio.m,
    },
    botones: {
        gap: Espacio.m,
        marginBottom: Espacio.xl,
    },
    confirmar: {
        gap: Espacio.m,
        padding: Espacio.l,
        borderRadius: 16,
        borderWidth: 1.5,
    },
});