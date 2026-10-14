import { Tabs } from 'expo-router/tabs';
import type { ComponentProps, ReactNode } from 'react';

import { useAccesibilidad } from '@/context/accesibilidad-context';

import { Icono, type NombreIcono } from './icono';

/**
 * Barra de pestañas de VITA (abajo de la pantalla), con los colores del tema y el tamaño
 * de texto de accesibilidad. Cada rol arma la suya con <Pestana /> en su _layout.
 */
export function Pestanas({ children }: { children: ReactNode }) {
    const { colores, tamano, altoContraste } = useAccesibilidad();

    return (
        <Tabs
            // "Volver" regresa a la pestaña anterior, no siempre a la primera
            backBehavior="history"
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
                    minHeight: 68,
                    paddingTop: 6,
                    paddingBottom: 6,
                },
                tabBarItemStyle: { borderRadius: 16, marginHorizontal: 4 },
                tabBarLabelStyle: { fontSize: tamano('pequeno'), fontWeight: '700' },
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
        tabBarIcon: ({ color }) => <Icono nombre={icono} tamano={24} color={color} />,
    };
}

/** Opciones de una pantalla que vive dentro de las pestañas pero no tiene botón propio (por ejemplo un detalle). */
export const pestanaOculta: OpcionesPestana = { href: null };