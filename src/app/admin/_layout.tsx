import { Tabs } from 'expo-router/tabs';

import { pestana, pestanaOculta, Pestanas } from '@/components/vita/pestanas';

/** Pestañas del administrador. El detalle de una cuenta vive aquí, pero sin pestaña propia. */
export default function AdminLayout() {
    return (
        <Pestanas>
            <Tabs.Screen name="index" options={pestana('Cuentas', 'pacientes')} />
            <Tabs.Screen name="nuevo-personal" options={pestana('Registrar', 'personaAgregar')} />
            <Tabs.Screen name="accesibilidad" options={pestana('Ajustes', 'ajustes', 'Ajustes de accesibilidad')} />
            <Tabs.Screen name="mi-cuenta" options={pestana('Mi cuenta', 'persona')} />
            <Tabs.Screen name="cuenta/[id]" options={pestanaOculta} />
        </Pestanas>
    );
}