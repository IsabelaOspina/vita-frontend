import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AccesibilidadProvider, useAccesibilidad } from '@/context/accesibilidad-context';
import { AsistenteProvider } from '@/context/asistente-context';

export default function RootLayout() {
    return (
        <AccesibilidadProvider>
            {/* El asistente "Oye VITA" escucha mientras el modo voz está activo */}
            <AsistenteProvider>
                <Navegacion />
            </AsistenteProvider>
        </AccesibilidadProvider>
    );
}

function Navegacion() {
    const { colores, altoContraste } = useAccesibilidad();

    // TODO(sesión): cuando existan pantallas privadas (por ejemplo el panel principal),
    // protegerlas con <Stack.Protected guard={...}> para que solo se entre con token.
    return (
        <>
            <StatusBar style={altoContraste ? 'light' : 'dark'} />
            <Stack
                screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: colores.fondo },
                    animation: 'slide_from_right',
                }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="login" />
                <Stack.Screen name="registro" />
            </Stack>
        </>
    );
}