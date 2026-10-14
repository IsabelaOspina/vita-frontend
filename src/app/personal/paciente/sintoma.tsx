import { PantallaDetalleSintoma } from '@/components/vita/pantalla-detalle-sintoma';
import { usePacienteAsignado } from '@/hooks/use-paciente-asignado';

/** Detalle de un síntoma de un paciente asignado (solo consulta). Ruta: ?paciente=3&sintoma=10 */
export default function SintomaPacienteScreen() {
    const { fuente, sintomaId } = usePacienteAsignado();
    return <PantallaDetalleSintoma fuente={fuente} id={sintomaId ?? 0} />;
}