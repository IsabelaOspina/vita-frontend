import { PantallaEvolucion } from '@/components/vita/pantalla-evolucion';
import { usePacienteAsignado } from '@/hooks/use-paciente-asignado';

/** Evolución de los síntomas de un paciente asignado. Ruta: ?paciente=3 */
export default function EvolucionPacienteScreen() {
    const { nombre, fuente } = usePacienteAsignado();
    return <PantallaEvolucion fuente={fuente} titulo={`Evolución de ${nombre.split(' ')[0]}`} />;
}