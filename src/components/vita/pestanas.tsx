import { StackActions } from 'expo-router/react-navigation';
import { Tabs } from 'expo-router/tabs';
import type { ComponentProps, ReactNode } from 'react';
import { useWindowDimensions, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAccesibilidad } from '@/context/accesibilidad-context';

import { Icono, type NombreIcono } from './icono';
import { ESCALA_MAXIMA_DEL_CELULAR, Texto } from './texto';

/** Tamaño de los íconos de la barra. */
const ICONO = 24;

/**
 * Barra de pestañas de VITA (abajo de la pantalla), con los colores del tema y el tamaño
 * de texto de accesibilidad. Cada rol arma la suya con <Pestana /> en su _layout.
 *
 * Al tocar una pestaña siempre se llega a su pantalla principal: si dentro de ella se había entrado
 * a otras pantallas (por ejemplo Mi salud → Medicamentos → Losartán), se vuelve al inicio de la sección.
 */
export function Pestanas({ children }: { children: ReactNode }) {
    const { colores, tamano, altoContraste } = useAccesibilidad();
    const { fontScale } = useWindowDimensions();
    const { bottom } = useSafeAreaInsets();
    // La altura de la barra se calcula con el tamaño real del texto (el de VITA y el del celular),
    // para que los nombres de las pestañas nunca queden cortados por abajo
    // (alto de línea del texto pequeño, el espacio del ícono y los márgenes internos de cada pestaña)
    const altoTexto = Math.ceil(tamano('pequeno') * Math.min(fontScale, ESCALA_MAXIMA_DEL_CELULAR) * 1.4);
    const altoBarra = 8 + 5 + (ICONO + 4) + altoTexto + 5 + 8 + 2 + bottom;

    return (
        <Tabs
            // "Volver" regresa a la pestaña anterior, no siempre a la primera
            backBehavior="history"
            screenListeners={({ navigation, route }) => ({
                tabPress: () => {
                    const pestanaTocada = navigation.getState()?.routes.find((r: { key: string }) => r.key === route.key);
                    const interna = pestanaTocada?.state;
                    // La pestaña tiene pantallas apiladas encima de la principal: se quitan todas
                    if (interna?.key && (interna.index ?? 0) > 0) {
                        navigation.dispatch({ ...StackActions.popToTop(), target: interna.key });
                    }
                },
            })}
            screenOptions={{
                headerShown: false,
                sceneStyle: { backgroundColor: colores.fondo },
                tabBarActiveTintColor: colores.primario,
                tabBarInactiveTintColor: colores.textoSecundario,
                tabBarActiveBackgroundColor: colores.superficieSuave,
                tabBarStyle: {
                    backgroundColor: colores.superficie,
                    borderTopColor: altoContraste ? colores.borde : colores.borde,
                    borderTopWidth: altoContraste ? 2 : 1,
                    height: altoBarra,
                    paddingTop: 8,
                    paddingBottom: 8 + bottom,
                },
                tabBarItemStyle: { borderRadius: 16, marginHorizontal: 4 },
            }}>
            {children}
        </Tabs>
    );
}

type OpcionesPestana = ComponentProps<typeof Tabs.Screen>['options'];

/** Opciones de una pestaña visible: título e ícono. */
export function pestana(titulo: string, icono: NombreIcono, descripcion?: string): OpcionesPestana {
    return {
        title: titulo,
        tabBarAccessibilityLabel: `${descripcion ?? titulo}, pestaña`,
        tabBarIcon: ({ color }) => <Icono nombre={icono} tamano={ICONO} color={color} />,
        tabBarLabel: ({ color }) => <EtiquetaPestana titulo={titulo} color={color} />,
    };
}

/** Opciones de una pantalla que vive dentro de las pestañas pero no tiene botón propio (por ejemplo un detalle). */
export const pestanaOculta: OpcionesPestana = { href: null };
/**
 * Nombre de la pestaña en una sola línea. Si no cabe en el ancho de la pestaña (pantalla angosta o
 * letra grande), la letra se achica lo justo para que se lea completo en vez de cortarse con "…".
 */
function EtiquetaPestana({ titulo, color }: { titulo: string; color: ColorValue }) {
    const { tamano } = useAccesibilidad();
    const { width, fontScale } = useWindowDimensions();
    const escala = Math.min(fontScale, ESCALA_MAXIMA_DEL_CELULAR);
    // Ancho de cada pestaña (hasta 4 en la barra) y lo que ocupa cada letra en negrita (aprox. 0,6 de su tamaño)
    const anchoPestana = width / 4 - 16;
    const tamanoQueCabe = anchoPestana / (titulo.length * 0.6 * escala);
    const fontSize = Math.max(10, Math.min(tamano('pequeno'), Math.floor(tamanoQueCabe)));
    return (
        <Texto
            variante="pequeno"
            peso="700"
            centrado
            numberOfLines={1}
            style={{ color, fontSize, lineHeight: Math.round(fontSize * 1.4) }}>
            {titulo}
        </Texto>
    );
}