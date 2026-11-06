import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Boton } from '@/components/vita/boton';
import { Encabezado } from '@/components/vita/encabezado';
import { FondoPantalla } from '@/components/vita/fondo-pantalla';
import { Tarjeta } from '@/components/vita/tarjeta';
import { Texto } from '@/components/vita/texto';
import { Espacio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';
import { useComandosPantalla } from '@/context/asistente-context';
import {
    aceptarDesdeLaPolitica,
    FECHA_POLITICA_DATOS,
    SECCIONES_POLITICA_DATOS,
    textoCompletoPolitica,
    VERSION_POLITICA_DATOS,
} from '@/utils/politica-datos';

/**
 * Política de tratamiento de datos personales. Se abre desde el registro (enlace junto a la
 * casilla). Si se abrió desde el registro (?desdeRegistro=1), el botón "Acepto la política"
 * vuelve y deja la casilla marcada.
 */
export default function PoliticaDatosScreen() {
    const { leer, anunciar } = useAccesibilidad();
    const { desdeRegistro } = useLocalSearchParams<{ desdeRegistro?: string }>();
    const puedeAceptar = desdeRegistro === '1';

    const volver = () => (router.canGoBack() ? router.back() : router.replace('/registro'));
    const aceptar = () => {
        aceptarDesdeLaPolitica();
        anunciar('Aceptaste la política de tratamiento de datos.');
        volver();
    };

    useComandosPantalla({
        titulo: 'Política de tratamiento de datos',
        descripcion:
            'Política de tratamiento de datos personales. Explica qué datos guarda VITA, para qué los usa, con quién los comparte y cuáles son tus derechos. ' +
            `Di: leer la política, para escucharla completa${puedeAceptar ? '; acepto, para aceptarla y volver al registro' : ''}; o volver.`,
        campos: [],
        ejemplos: ['leer la política', ...(puedeAceptar ? ['acepto la política'] : []), 'volver'],
        acciones: [
            ...(puedeAceptar
                ? [{ frases: ['acepto', 'acepto la politica', 'aceptar', 'aceptar la politica', 'estoy de acuerdo'], etiqueta: 'aceptar la política', ejecutar: aceptar }]
                : []),
            {
                frases: ['leer la politica', 'leela', 'leer todo', 'leer completa', 'lee la politica', 'escuchar la politica'],
                etiqueta: 'leer la política completa',
                ejecutar: () => leer(textoCompletoPolitica()),
            },
            { frases: ['volver', 'atras', 'regresar', 'no acepto'], ejecutar: volver },
        ],
    });

    return (
        <FondoPantalla>
            <Encabezado
                volver
                alVolver={volver}
                icono="documento"
                titulo="Política de tratamiento de datos"
                subtitulo={`Versión ${VERSION_POLITICA_DATOS} · ${FECHA_POLITICA_DATOS}`}
            />

            {SECCIONES_POLITICA_DATOS.map((seccion) => (
                <Tarjeta key={seccion.titulo}>
                    <Texto variante="subtitulo" accessibilityRole="header">
                        {seccion.titulo}
                    </Texto>
                    {seccion.parrafos.map((p) => (
                        <Texto key={p} variante="cuerpo">
                            {p}
                        </Texto>
                    ))}
                </Tarjeta>
            ))}

            <View style={styles.botones}>
                {puedeAceptar && <Boton titulo="Acepto la política" icono="check" onPress={aceptar} />}
                <Boton titulo="Volver" variante="secundario" onPress={volver} />
            </View>
        </FondoPantalla>
    );
}

const styles = StyleSheet.create({
    botones: {
        gap: Espacio.m,
        marginBottom: Espacio.xl,
    },
});