import { PantallaEvolucion } from '@/components/vita/pantalla-evolucion';
import { fuentePaciente } from '@/utils/fuente-sintomas';

/** Evolución de los síntomas del paciente. */
export default function EvolucionSintomasScreen() {
    return <PantallaEvolucion fuente={fuentePaciente} titulo="Evolución" />;
}
