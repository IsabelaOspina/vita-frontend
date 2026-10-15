import { PantallaHistorial } from '@/components/vita/pantalla-historial';
import { usePacienteAsignado } from '@/hooks/use-paciente-asignado';

/** Historial completo de síntomas de un paciente asignado (solo consulta). Ruta: ?paciente=3 */
export default function HistorialPacienteScreen() {
    const { nombre, fuente } = usePacienteAsignado();
    return <PantallaHistorial fuente={fuente} nombrePaciente={nombre} />;
}