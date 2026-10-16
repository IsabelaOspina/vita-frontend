import { useLocalSearchParams } from 'expo-router';

import { PantallaDetalleMedicamento } from '@/components/vita/pantalla-detalle-medicamento';

/** Un medicamento con sus horarios y las tomas de la semana. */
export default function DetalleMedicamentoScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    return <PantallaDetalleMedicamento id={Number(id)} />;
}
