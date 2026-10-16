import { Stack } from 'expo-router';

import { useAccesibilidad } from '@/context/accesibilidad-context';

/**
 * Pestaña "Mi salud": el menú (index) y, encima de él, Hoy, la agenda, los medicamentos y los
 * síntomas con todas sus pantallas. "Volver" regresa paso a paso hasta el menú.
 */
export const unstable_settings = { initialRouteName: 'index' };

export default function SaludLayout() {
    const { colores } = useAccesibilidad();

    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colores.fondo },
                animation: 'slide_from_right',
            }}
        />
    );
}
