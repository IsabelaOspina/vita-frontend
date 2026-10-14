import { router } from 'expo-router';

import { PantallaSintomas } from '@/components/vita/pantalla-sintomas';
import { usePacienteAsignado } from '@/hooks/use-paciente-asignado';

/** Síntomas de un paciente asignado (solo consulta): resumen, historial y evolución. */
export default function SintomasPacienteScreen() {
    const { nombre, fuente } = usePacienteAsignado();

    return (
        <PantallaSintomas
            fuente={fuente}
            titulo={nombre}
            subtitulo="Síntomas del paciente · solo consulta"
            icono="sintomas"
            nombrePaciente={nombre}
            alVolver={() => router.navigate('/personal')}
        />
    );
}