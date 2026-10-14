import { Tabs } from 'expo-router/tabs';

import { pestana, Pestanas } from '@/components/vita/pestanas';

/** Pestañas del paciente (rol USUARIO). */
export default function PacienteLayout() {
    return (
        <Pestanas>
            <Tabs.Screen name="index" options={pestana('Inicio', 'casa')} />
            <Tabs.Screen name="accesibilidad" options={pestana('Ajustes', 'ajustes', 'Ajustes de accesibilidad')} />
            <Tabs.Screen name="mi-cuenta" options={pestana('Mi cuenta', 'persona')} />
        </Pestanas>
    );
}