import { Tabs } from 'expo-router/tabs';
import { useEffect } from 'react';

import { pestana, pestanaOculta, Pestanas } from '@/components/vita/pestanas';
import { VigilanteRecordatorios } from '@/components/vita/vigilante-recordatorios';
import { useAsistente } from '@/context/asistente-context';

/**
 * Pestañas del paciente (rol USUARIO). Agenda, medicamentos y síntomas están dentro de "Mi salud".
 * El vigilante avisa los recordatorios a su hora en cualquier pantalla del paciente.
 * Mientras el paciente está en VITA, la escucha de emergencia queda permitida: con el modo voz
 * apagado, decir "pedir ayuda" o "auxilio" activa el modo voz y abre "Pedir ayuda".
 */
export default function PacienteLayout() {
    const { permitirEscuchaEmergencia } = useAsistente();

    useEffect(() => {
        permitirEscuchaEmergencia(true);
        // Al cerrar sesión (o salir de las pantallas del paciente) se deja de escuchar
        return () => permitirEscuchaEmergencia(false);
    }, [permitirEscuchaEmergencia]);

    return (
        <>
            <Pestanas>
                <Tabs.Screen name="index" options={pestana('Inicio', 'casa')} />
                <Tabs.Screen name="salud" options={pestana('Mi salud', 'salud', 'Mi salud: agenda, medicamentos y síntomas')} />
                <Tabs.Screen name="accesibilidad" options={pestana('Ajustes', 'ajustes', 'Ajustes de accesibilidad')} />
                <Tabs.Screen name="mi-cuenta" options={pestana('Mi cuenta', 'persona')} />
                {/* Emergencias: se llega desde el botón "Pedir ayuda" de Inicio, desde Mi cuenta o por voz */}
                <Tabs.Screen name="emergencia" options={pestanaOculta} />
                <Tabs.Screen name="contacto-emergencia" options={pestanaOculta} />
            </Pestanas>
            <VigilanteRecordatorios />
        </>
    );
}