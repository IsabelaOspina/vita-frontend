import { PantallaSintomas } from '@/components/vita/pantalla-sintomas';
import { fuentePaciente } from '@/utils/fuente-sintomas';

/** Pestaña "Síntomas" del paciente: resumen, historial y el botón para registrar uno. */
export default function SintomasScreen() {
    return <PantallaSintomas fuente={fuentePaciente} titulo="Mis síntomas" subtitulo="Lleva el registro de cómo te sientes." icono="sintomas" />;
}