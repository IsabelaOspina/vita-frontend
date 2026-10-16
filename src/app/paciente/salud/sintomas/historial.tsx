import { PantallaHistorial } from '@/components/vita/pantalla-historial';
import { fuentePaciente } from '@/utils/fuente-sintomas';

/** Historial completo de síntomas del paciente, con filtros. */
export default function HistorialSintomasScreen() {
    return <PantallaHistorial fuente={fuentePaciente} />;
}
