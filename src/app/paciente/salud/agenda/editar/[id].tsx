import { useLocalSearchParams } from 'expo-router';

import { FormularioActividad } from '@/components/vita/formulario-actividad';

/** Editar una actividad pendiente. */
export default function EditarActividadScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    return <FormularioActividad id={Number(id)} />;
}
