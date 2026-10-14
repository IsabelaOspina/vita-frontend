import { Stack } from 'expo-router';

import { useAccesibilidad } from '@/context/accesibilidad-context';

export default function SintomasLayout() {
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