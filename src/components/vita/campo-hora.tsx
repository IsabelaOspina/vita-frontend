import { forwardRef } from 'react';
import type { TextInput } from 'react-native';

import { interpretarHora, unirFechaHora } from '@/utils/salud';
import { horaCorta } from '@/utils/fechas';
import { errorHora } from '@/utils/validaciones';

import { Campo } from './campo';

type Props = {
    etiqueta: string;
    valor: string;
    onCambiar: (valor: string) => void;
    /** Recibe el error de la hora (o undefined cuando ya es válida). */
    onError: (error: string | undefined) => void;
    error?: string;
    ayuda?: string;
    placeholder?: string;
    obligatorio?: boolean;
    /** Mensaje cuando el campo obligatorio queda vacío. */
    mensajeVacio?: string;
    onSubmitEditing?: () => void;
};

/**
 * Campo para escribir una hora ("8:30 p. m.", "20:30", "3 de la tarde"…). Al salir del campo revisa
 * que sea una hora real: si lo es, la deja escrita como "8:30 p. m."; si no (por ejemplo "25:00" o
 * "hola"), muestra el error debajo: "La hora no es válida. Ejemplo: 8:30 a. m. o 3:00 p. m.".
 */
export const CampoHora = forwardRef<TextInput, Props>(function CampoHora(
    { etiqueta, valor, onCambiar, onError, error, ayuda, placeholder = 'Ej: 8:30 a. m.', obligatorio, mensajeVacio, onSubmitEditing },
    ref,
) {
    const validar = () => {
        const texto = valor.trim();
        if (!texto) {
            // Vacío: el error de "obligatorio" se muestra al guardar, no al pasar por el campo
            return;
        }
        const hora = interpretarHora(texto);
        if (hora) {
            onCambiar(horaCorta(unirFechaHora(new Date(), hora)));
            onError(undefined);
        } else {
            onError(errorHora(texto, mensajeVacio) ?? undefined);
        }
    };

    return (
        <Campo
            ref={ref}
            etiqueta={etiqueta}
            obligatorio={obligatorio}
            icono="reloj"
            placeholder={placeholder}
            value={valor}
            onChangeText={(v) => {
                onCambiar(v);
                if (error) onError(undefined);
            }}
            onBlur={validar}
            onSubmitEditing={() => {
                validar();
                onSubmitEditing?.();
            }}
            error={error}
            ayuda={ayuda}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={25}
            returnKeyType={onSubmitEditing ? 'next' : 'done'}
        />
    );
});
