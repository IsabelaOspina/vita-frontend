import { Tabs } from 'expo-router/tabs';

import { pestana, Pestanas } from '@/components/vita/pestanas';
import { VigilanteRecordatorios } from '@/components/vita/vigilante-recordatorios';

/**
 * Pestañas del paciente (rol USUARIO). Agenda, medicamentos y síntomas están dentro de "Mi salud".
 * El vigilante avisa los recordatorios a su hora en cualquier pantalla del paciente.
 */
export default function PacienteLayout() {
    return (
        <>
            <Pestanas>
                <Tabs.Screen name="index" options={pestana('Inicio', 'casa')} />
                <Tabs.Screen name="salud" options={pestana('Mi salud', 'salud', 'Mi salud: agenda, medicamentos y síntomas')} />
                <Tabs.Screen name="accesibilidad" options={pestana('Ajustes', 'ajustes', 'Ajustes de accesibilidad')} />
                <Tabs.Screen name="mi-cuenta" options={pestana('Mi cuenta', 'persona')} />
            </Pestanas>
            <VigilanteRecordatorios />
        </>
    );
}
