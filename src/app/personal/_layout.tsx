import { Tabs } from 'expo-router/tabs';

import { pestana, Pestanas } from '@/components/vita/pestanas';

/** Pestañas del personal de salud. */
export default function PersonalLayout() {
    return (
        <Pestanas>
            <Tabs.Screen name="index" options={pestana('Mis pacientes', 'pacientes')} />
            <Tabs.Screen name="accesibilidad" options={pestana('Ajustes', 'ajustes', 'Ajustes de accesibilidad')} />
            <Tabs.Screen name="mi-cuenta" options={pestana('Mi cuenta', 'persona')} />
        </Pestanas>
    );
}