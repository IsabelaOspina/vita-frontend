import { router } from 'expo-router';

import { PantallaSintomas } from '@/components/vita/pantalla-sintomas';
import { fuentePaciente } from '@/utils/fuente-sintomas';

/** Síntomas del paciente (dentro de "Mi salud"): resumen, recientes y el botón para registrar uno. */
export default function SintomasScreen() {
    return (
        <PantallaSintomas
            fuente={fuentePaciente}
            titulo="Mis síntomas"
            subtitulo="Lleva el registro de cómo te sientes."
            icono="sintomas"
            alVolver={() => router.navigate('/paciente/salud')}
        />
    );
}
