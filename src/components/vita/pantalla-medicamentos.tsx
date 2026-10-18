import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Espacio, Radio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';
import { useComandosPantalla } from '@/context/asistente-context';
import type { MedicamentoResponse } from '@/dto/MedicamentoResponse';
import { listarMedicamentos } from '@/services/medicamentoService';
import { aPalabras, type Resultado } from '@/utils/comandos-voz';
import { tomarAvisoPendiente } from '@/utils/fuente-sintomas';
import { mensajeDeError } from '@/utils/sesion';

import { accionesComunesVoz } from './acciones-cuenta';
import { Aviso } from './aviso';
import { Boton } from './boton';
import { Encabezado } from './encabezado';
import { EstadoCarga } from './estado-carga';
import { FondoPantalla } from './fondo-pantalla';
import { Icono } from './icono';
import { Tarjeta } from './tarjeta';
import { Texto } from './texto';

/** "Agrega metformina 850 miligramos", "nuevo medicamento losartán". */
const NUEVO = /^(?:agrega(?:r)?|registra(?:r)?|nuevo medicamento|anota(?:r)?|tomo)\s+(?:el |la |un |una |medicamento )?(.+)$/;

/** "metformina 850 miligramos" → { nombre: "Metformina", dosis: "850 mg" } */
export function separarMedicamento(texto: string): { nombre: string; dosis?: string } {
    const m = /^(.*?)\s+(\d+(?:[.,]\d+)?\s*(?:mg|miligramos?|g|gramos?|ml|mililitros?|mcg|microgramos?|ui|unidades?|gotas?|tabletas?|pastillas?|capsulas?)\b.*)$/i.exec(texto.trim());
    const capital = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
    if (!m) return { nombre: capital(texto.trim()) };
    const dosis = m[2]
        .replace(/miligramos?/i, 'mg')
        .replace(/mililitros?/i, 'ml')
        .replace(/microgramos?/i, 'mcg')
        .replace(/gramos?/i, 'g')
        .replace(/\s+/g, ' ');
    return { nombre: capital(m[1]), dosis };
}

/** Un medicamento de la lista. */
function ElementoMedicamento({ medicamento, numero, onPress }: { medicamento: MedicamentoResponse; numero: number; onPress: () => void }) {
    const { colores } = useAccesibilidad();
    const detalle = [medicamento.dosis, medicamento.viaAdministracion].filter(Boolean).join(' · ');
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={`${numero}. ${medicamento.nombre}${detalle ? `, ${detalle}` : ''}${medicamento.activo ? '' : ', desactivado'}`}
            accessibilityHint="Abre el medicamento con sus horarios y tomas"
            style={({ pressed }) => [
                styles.medicamento,
                { borderColor: colores.borde, backgroundColor: pressed ? colores.superficieSuave : colores.superficie, opacity: medicamento.activo ? 1 : 0.7 },
            ]}>
            <View style={[styles.icono, { backgroundColor: medicamento.activo ? colores.exitoFondo : colores.superficieSuave }]}>
                <Icono nombre="medicamento" tamano={26} color={medicamento.activo ? colores.exito : colores.textoSecundario} />
            </View>
            <View style={styles.textos}>
                <Texto variante="cuerpo" peso="700">
                    {medicamento.nombre}
                </Texto>
                {detalle ? (
                    <Texto variante="pequeno" color="textoSecundario">
                        {detalle}
                    </Texto>
                ) : null}
            </View>
            <Icono nombre="siguiente" tamano={22} color={colores.textoTenue} />
        </Pressable>
    );
}

/** Lista de medicamentos: los activos y, aparte, los desactivados. */
export function PantallaMedicamentos() {
    const { anunciar } = useAccesibilidad();
    const [medicamentos, setMedicamentos] = useState<MedicamentoResponse[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [verDesactivados, setVerDesactivados] = useState(false);
    const [aviso, setAviso] = useState<string | null>(null);

    const cargar = useCallback(async () => {
        setCargando(true);
        setError(null);
        try {
            setMedicamentos((await listarMedicamentos()).sort((a, b) => a.nombre.localeCompare(b.nombre)));
        } catch (e) {
            setError(mensajeDeError(e, 'No pudimos cargar tus medicamentos.'));
        } finally {
            setCargando(false);
        }
    }, []);

    const cargarRef = useRef(cargar);
    cargarRef.current = cargar;
    useFocusEffect(
        useCallback(() => {
            const pendiente = tomarAvisoPendiente();
            if (pendiente) setAviso(pendiente);
            void cargarRef.current();
        }, []),
    );

    const activos = medicamentos.filter((m) => m.activo);
    const desactivados = medicamentos.filter((m) => !m.activo);
    const abrir = (m: MedicamentoResponse) => router.push({ pathname: '/paciente/salud/medicamentos/[id]', params: { id: String(m.id) } });
    const nuevo = (params?: Record<string, string>) => router.push({ pathname: '/paciente/salud/medicamentos/nuevo', params: params ?? {} });

    const dictado = (texto: string): Resultado[] | null => {
        const pedido = NUEVO.exec(aPalabras(texto));
        if (!pedido || /^(un )?medicamento$/.test(pedido[1])) return null;
        const { nombre, dosis } = separarMedicamento(pedido[1]);
        return [{ tipo: 'accion', indice: -1, accion: { frases: [], ejecutar: () => nuevo({ nombre, ...(dosis ? { dosis } : {}) }) } }];
    };

    useComandosPantalla({
        cargando: cargando,
        titulo: 'Medicamentos',
        descripcion: `Medicamentos. Tienes ${activos.length === 1 ? '1 activo' : `${activos.length} activos`}. Puedes decir: lee la lista, abre y el nombre, o agrega metformina 850 miligramos.`,
        ejemplos: ['lee la lista', 'abre el losartán', 'agrega metformina 850 miligramos', 'nuevo medicamento'],
        campos: [],
        listas: [
            {
                claves: ['lee la lista', 'mis medicamentos', 'lista', 'que tomo', 'que medicamentos tengo'],
                nombre: 'Tus medicamentos',
                vacia: 'Todavía no has registrado medicamentos.',
                elementos: activos.map((m) => ({ nombre: m.nombre, detalle: [m.dosis, m.viaAdministracion].filter(Boolean).join(', ') || undefined })),
                acciones: [{ frases: ['abre', 'abrir', 'ver', 'muestra', 'detalle de'], ejecutar: (i) => abrir(activos[i]) }],
            },
            {
                claves: ['desactivados', 'lee los desactivados', 'medicamentos desactivados'],
                nombre: 'Medicamentos desactivados',
                vacia: 'No tienes medicamentos desactivados.',
                elementos: desactivados.map((m) => ({ nombre: m.nombre })),
                acciones: [{ frases: ['abre', 'abrir', 'ver'], ejecutar: (i) => abrir(desactivados[i]) }],
            },
        ],
        acciones: [
            { frases: ['nuevo medicamento', 'agregar medicamento', 'registrar medicamento', 'agrega un medicamento'], etiqueta: 'registrar un medicamento', ejecutar: () => nuevo() },
            { frases: ['volver', 'atras', 'regresar'], ejecutar: () => (router.canGoBack() ? router.back() : router.replace('/paciente/salud')) },
            ...accionesComunesVoz('USUARIO', anunciar),
        ],
        dictado,
    });

    return (
        <FondoPantalla>
            <Encabezado volver alVolver={() => router.replace('/paciente/salud')} icono="medicamento" titulo="Medicamentos" subtitulo="Tus medicamentos, sus horarios y tomas" />

            {aviso && (
                <View style={styles.espacio}>
                    <Aviso tipo="exito" mensaje={aviso} />
                </View>
            )}

            <View style={styles.espacio}>
                <Boton titulo="Nuevo medicamento" icono="agregar" onPress={() => nuevo()} />
            </View>

            <Tarjeta
                titulo="Activos"
                icono="medicamento"
                extra={
                    activos.length > 0 ? (
                        <Texto variante="subtitulo" color="primario" accessibilityLabel={`${activos.length} activos`}>
                            {activos.length}
                        </Texto>
                    ) : null
                }>
                <EstadoCarga
                    cargando={cargando && medicamentos.length === 0}
                    error={error}
                    reintentar={cargar}
                    hayDatos={activos.length > 0}
                    vacio="Todavía no has registrado medicamentos. Toca «Nuevo medicamento» para agregar el primero."
                />
                <View style={styles.lista}>
                    {activos.map((m, i) => (
                        <ElementoMedicamento key={m.id} medicamento={m} numero={i + 1} onPress={() => abrir(m)} />
                    ))}
                </View>
            </Tarjeta>

            {desactivados.length > 0 && (
                <Tarjeta titulo="Desactivados" icono="cancelar">
                    <Boton
                        titulo={verDesactivados ? 'Ocultar desactivados' : `Ver desactivados (${desactivados.length})`}
                        variante="secundario"
                        onPress={() => setVerDesactivados((v) => !v)}
                    />
                    {verDesactivados && (
                        <View style={styles.lista}>
                            {desactivados.map((m, i) => (
                                <ElementoMedicamento key={m.id} medicamento={m} numero={i + 1} onPress={() => abrir(m)} />
                            ))}
                        </View>
                    )}
                </Tarjeta>
            )}
        </FondoPantalla>
    );
}

const styles = StyleSheet.create({
    espacio: {
        marginBottom: Espacio.l,
    },
    lista: {
        gap: Espacio.s,
    },
    medicamento: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Espacio.m,
        padding: Espacio.m,
        borderWidth: 1.5,
        borderRadius: Radio.m,
    },
    icono: {
        width: 48,
        height: 48,
        borderRadius: Radio.s,
        alignItems: 'center',
        justifyContent: 'center',
    },
    textos: {
        flex: 1,
        minWidth: 0,
        gap: 2,
    },
});