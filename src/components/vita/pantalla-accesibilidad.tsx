import { StyleSheet, View } from 'react-native';

import { Espacio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';
import { useComandosPantalla } from '@/context/asistente-context';
import type { Rol } from '@/dto/Rol';

import { accionesComunesVoz, salir } from './acciones-cuenta';
import { BarraAccesibilidad } from './barra-accesibilidad';
import { Encabezado } from './encabezado';
import { FondoPantalla } from './fondo-pantalla';
import { Icono, type NombreIcono } from './icono';
import { Tarjeta } from './tarjeta';
import { Texto } from './texto';

const EXPLICACIONES: { icono: NombreIcono; titulo: string; texto: string }[] = [
    {
        icono: 'microfono',
        titulo: 'Modo voz',
        texto: 'VITA lee en voz alta las pantallas y los mensajes, y puedes darle órdenes diciendo «Oye VITA».',
    },
    {
        icono: 'contraste',
        titulo: 'Alto contraste',
        texto: 'Fondo negro con letras blancas y amarillas, para ver mejor con poca visión.',
    },
    {
        icono: 'tamanoTexto',
        titulo: 'Tamaño de texto',
        texto: 'Cada toque agranda las letras: 100 %, 120 % y 140 %.',
    },
];

/** Pestaña "Accesibilidad" (igual para todos los roles): modo voz, alto contraste y tamaño de texto. */
export function PantallaAccesibilidad({ rol }: { rol: Rol }) {
    const { colores, anunciar, modoVoz, altoContraste, escalaTexto } = useAccesibilidad();

    useComandosPantalla({
        titulo: 'Accesibilidad',
        descripcion:
            'Accesibilidad. Puedes decir: activa el alto contraste, aumenta el texto, disminuye el texto, ' +
            'o desactiva el modo voz.',
        ejemplos: ['activa el alto contraste', 'aumenta el texto', 'disminuye el texto', 'habla más despacio'],
        campos: [],
        acciones: [
            {
                frases: ['como esta', 'estado', 'que tengo activado', 'lee los ajustes'],
                ejecutar: () =>
                    anunciar(
                        `Modo voz ${modoVoz ? 'activado' : 'desactivado'}. Alto contraste ${altoContraste ? 'activado' : 'desactivado'}. ` +
                        `Tamaño de texto ${Math.round(escalaTexto * 100)} por ciento.`,
                    ),
            },
            ...accionesComunesVoz(rol, anunciar),
        ],
    });

    return (
        <FondoPantalla>
            <Encabezado
                accesibilidad={false}
                alCerrarSesion={() => salir(anunciar)}
                icono="ajustes"
                titulo="Accesibilidad"
                subtitulo="Ajusta VITA para que te sea más cómoda."
            />

            <Tarjeta>
                <BarraAccesibilidad />
            </Tarjeta>

            <Tarjeta titulo="¿Qué hace cada opción?" icono="info">
                {EXPLICACIONES.map((e) => (
                    <View key={e.titulo} style={styles.fila} accessible accessibilityLabel={`${e.titulo}: ${e.texto}`}>
                        <Icono nombre={e.icono} tamano={24} color={colores.primario} />
                        <View style={styles.textos}>
                            <Texto variante="cuerpo" peso="700">
                                {e.titulo}
                            </Texto>
                            <Texto variante="etiqueta" color="textoSecundario" peso="400">
                                {e.texto}
                            </Texto>
                        </View>
                    </View>
                ))}
            </Tarjeta>
        </FondoPantalla>
    );
}

const styles = StyleSheet.create({
    fila: {
        flexDirection: 'row',
        gap: Espacio.m,
        alignItems: 'flex-start',
    },
    textos: {
        flex: 1,
        gap: 2,
    },
});