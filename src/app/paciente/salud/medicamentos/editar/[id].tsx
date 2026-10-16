import { useLocalSearchParams } from 'expo-router';

import { FormularioMedicamento } from '@/components/vita/formulario-medicamento';

/** Editar un medicamento. */
export default function EditarMedicamentoScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    return <FormularioMedicamento id={Number(id)} />;
}
