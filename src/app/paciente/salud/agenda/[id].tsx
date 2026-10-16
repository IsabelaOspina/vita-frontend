import { useLocalSearchParams } from 'expo-router';

import { PantallaDetalleActividad } from '@/components/vita/pantalla-detalle-actividad';

/** Detalle de una actividad: datos, recordatorios y acciones. */
export default function DetalleActividadScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    return <PantallaDetalleActividad id={Number(id)} />;
}
