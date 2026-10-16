import { useLocalSearchParams } from 'expo-router';

import { FormularioSintoma } from '@/components/vita/formulario-sintoma';

/** Editar un síntoma ya registrado. */
export default function EditarSintomaScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    return <FormularioSintoma id={Number(id)} />;
}
