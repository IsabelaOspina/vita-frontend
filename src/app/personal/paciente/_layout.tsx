import { Stack } from 'expo-router';

import { useAccesibilidad } from '@/context/accesibilidad-context';

/** Síntomas de un paciente (personal de salud): la lista, el detalle y la evolución. */
export default function PacienteLayout() {
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