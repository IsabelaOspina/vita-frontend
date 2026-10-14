import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';

import { consultarMisPacientes } from '@/services/personalSaludService';
import { fuenteProfesional } from '@/utils/fuente-sintomas';

/**
 * El paciente que el profesional está consultando, a partir de la ruta
 * (/personal/paciente/3 o ?paciente=3). El nombre llega en la ruta; si no (por ejemplo, al abrir
 * un enlace directo), se busca entre los pacientes asignados.
 */
export function usePacienteAsignado() {
    const params = useLocalSearchParams<{ id?: string; paciente?: string; nombre?: string; sintoma?: string }>();
    const pacienteId = Number(params.paciente ?? params.id);
    const [nombre, setNombre] = useState(params.nombre ?? '');

    useEffect(() => {
        if (nombre || !pacienteId) return;
        consultarMisPacientes()
            .then((pacientes) => {
                const encontrado = pacientes.find((p) => p.pacienteId === pacienteId);
                setNombre(encontrado?.pacienteNombre ?? 'Paciente');
            })
            .catch(() => setNombre('Paciente'));
    }, [nombre, pacienteId]);

    const fuente = useMemo(() => fuenteProfesional(pacienteId, nombre || 'Paciente'), [pacienteId, nombre]);

    return { pacienteId, nombre: nombre || 'Paciente', fuente, sintomaId: params.sintoma ? Number(params.sintoma) : null };
}