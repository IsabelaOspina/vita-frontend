import { PantallaRecomendacionesProfesional } from '@/components/vita/pantalla-recomendaciones-profesional';
import { usePacienteAsignado } from '@/hooks/use-paciente-asignado';

/** Recomendaciones del profesional a un paciente asignado. Ruta: ?paciente=3&nombre=…&sintoma=10 (el síntoma es opcional). */
export default function RecomendacionesPacienteScreen() {
    const { pacienteId, nombre, fuente, sintomaId } = usePacienteAsignado();
    return <PantallaRecomendacionesProfesional pacienteId={pacienteId} nombre={nombre} fuente={fuente} sintomaId={sintomaId} />;
}
