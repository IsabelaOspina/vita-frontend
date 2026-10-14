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

    // TODO(sesión): cuando exista el contexto de sesión, proteger las pantallas de cada rol con
    // <Stack.Protected guard={...}> para que solo se entre con token y con el rol correcto.
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
                <Stack.Screen name="inicio" />
                <Stack.Screen name="personal" />
                <Stack.Screen name="admin/index" />
                <Stack.Screen name="admin/nuevo-personal" />
                <Stack.Screen name="admin/cuenta/[id]" />
                <Stack.Screen name="cambiar-contrasena" />
            </Stack>
        </>
    );
}