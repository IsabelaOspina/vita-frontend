import { Platform, StyleSheet, View } from 'react-native';

import { Espacio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';
import { useAsistente, useComandosPantalla } from '@/context/asistente-context';
import type { Rol } from '@/dto/Rol';

import { accionesComunesVoz, salir } from './acciones-cuenta';
import { BarraAccesibilidad } from './barra-accesibilidad';
import { Boton } from './boton';
import { Encabezado } from './encabezado';
import { FondoPantalla } from './fondo-pantalla';
import { Icono, type NombreIcono } from './icono';
import { abrirAjustesDelCelular, TarjetaAvisosBloqueados, useAvisosBloqueados } from './tarjeta-avisos-celular';
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

/**
 * Pestaña "Accesibilidad" (igual para todos los roles): modo voz, alto contraste y tamaño de texto.
 * El paciente además puede activar o desactivar la escucha de emergencia ("pedir ayuda" con el modo voz apagado).
 * Al paciente, en el celular, le avisa si las notificaciones de VITA están desactivadas (sin ellas
 * los recordatorios no llegan con la app cerrada).
 */
export function PantallaAccesibilidad({ rol }: { rol: Rol }) {
    const { colores, anunciar, modoVoz, altoContraste, escalaTexto, escuchaEmergencia, alternarEscuchaEmergencia } = useAccesibilidad();
    const { disponible } = useAsistente();
    const esPaciente = rol === 'USUARIO';
    const avisosBloqueados = useAvisosBloqueados(rol === 'USUARIO' && Platform.OS !== 'web');

    useComandosPantalla({
        titulo: 'Accesibilidad',
        descripcion:
            'Accesibilidad. Puedes decir: activa el alto contraste, aumenta el texto, disminuye el texto, ' +
            'o desactiva el modo voz.' +
            (avisosBloqueados ? ' Las notificaciones de VITA están desactivadas; para activarlas di: activar notificaciones.' : '') +
            (esPaciente && disponible
                ? ` Escucha de emergencia ${escuchaEmergencia ? 'activada' : 'desactivada'}; para cambiarla di: ${escuchaEmergencia ? 'desactivar' : 'activar'} escucha de emergencia.`
                : ''),
        ejemplos: ['activa el alto contraste', 'aumenta el texto', 'disminuye el texto', 'habla más despacio'],
        campos: [],
        acciones: [
            {
                frases: ['como esta', 'estado', 'que tengo activado', 'lee los ajustes'],
                ejecutar: () =>
                    anunciar(
                        `Modo voz ${modoVoz ? 'activado' : 'desactivado'}. Alto contraste ${altoContraste ? 'activado' : 'desactivado'}. ` +
                        `Tamaño de texto ${Math.round(escalaTexto * 100)} por ciento.` +
                        (esPaciente && disponible ? ` Escucha de emergencia ${escuchaEmergencia ? 'activada' : 'desactivada'}.` : ''),
                    ),
            },
            ...(avisosBloqueados
                ? [
                    {
                        frases: ['activar notificaciones', 'activa las notificaciones', 'permitir notificaciones', 'abrir ajustes de vita'],
                        etiqueta: 'activar las notificaciones',
                        ejecutar: abrirAjustesDelCelular,
                    },
                ]
                : []),
            ...(esPaciente && disponible
                ? [
                    {
                        frases: escuchaEmergencia
                            ? ['desactivar escucha de emergencia', 'desactiva la escucha de emergencia', 'apagar escucha de emergencia', 'quitar escucha de emergencia']
                            : ['activar escucha de emergencia', 'activa la escucha de emergencia', 'encender escucha de emergencia'],
                        etiqueta: `${escuchaEmergencia ? 'desactivar' : 'activar'} la escucha de emergencia`,
                        ejecutar: alternarEscuchaEmergencia,
                    },
                ]
                : []),
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

            <TarjetaAvisosBloqueados bloqueados={avisosBloqueados} />

            {/* Solo donde hay reconocimiento de voz (APK, Chrome y Edge) */}
            {esPaciente && disponible && (
                <Tarjeta titulo="Escucha de emergencia" icono="emergencia">
                    <Texto variante="cuerpo" color="textoSecundario">
                        {escuchaEmergencia
                            ? 'Activada. Con VITA abierta, aunque el modo voz esté apagado, di «pedir ayuda» o «auxilio» y VITA te ayudará a avisar a tu contacto de emergencia.'
                            : 'Desactivada. Para pedir ayuda usa el botón rojo «Pedir ayuda».'}
                    </Texto>
                    <Texto variante="pequeno" color="textoSecundario">
                        Mientras está activada, el micrófono queda encendido con VITA abierta. Al oír «pedir ayuda», VITA siempre te pregunta antes de enviar la alerta.
                    </Texto>
                    <Boton
                        titulo={escuchaEmergencia ? 'Desactivar escucha de emergencia' : 'Activar escucha de emergencia'}
                        icono={escuchaEmergencia ? undefined : 'microfono'}
                        variante={escuchaEmergencia ? 'secundario' : 'primario'}
                        onPress={alternarEscuchaEmergencia}
                    />
                </Tarjeta>
            )}

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