import { useLocalSearchParams } from 'expo-router';

import { PantallaDetalleSintoma } from '@/components/vita/pantalla-detalle-sintoma';
import { fuentePaciente } from '@/utils/fuente-sintomas';

/** Detalle de un síntoma del paciente, con editar y eliminar. */
export default function DetalleSintomaScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    return <PantallaDetalleSintoma fuente={fuentePaciente} id={Number(id)} />;
}