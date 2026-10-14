import { Pressable, StyleSheet, View } from 'react-native';

import { Espacio, Radio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';
import type { SintomaResponse } from '@/dto/SintomaResponse';
import { fechaHoraCorta } from '@/utils/fechas';
import { nombreNivel } from '@/utils/sintomas';

import { Icono } from './icono';
import { InsigniaIntensidad } from './insignia-intensidad';
import { Texto } from './texto';

type Props = {
    sintoma: SintomaResponse;
    /** Número en la lista, para poder pedirlo por voz ("abre el 2"). */
    numero: number;
    onPress: () => void;
};

/** Un síntoma del historial: intensidad, tipo, cuándo y el comienzo de las observaciones. */
export function ElementoSintoma({ sintoma, numero, onPress }: Props) {
    const { colores } = useAccesibilidad();
    const cuando = fechaHoraCorta(sintoma.fechaHora);
    const nivel = nombreNivel(sintoma.nivelIntensidad).toLowerCase();

    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={`${numero}. ${sintoma.tipo}, intensidad ${sintoma.intensidad} de 10, ${nivel}. ${cuando}`}
            accessibilityHint="Abre el detalle del síntoma"
            style={({ pressed }) => [
                styles.contenedor,
                { borderColor: colores.borde, backgroundColor: pressed ? colores.superficieSuave : colores.superficie },
            ]}>
            <InsigniaIntensidad intensidad={sintoma.intensidad} />
            <View style={styles.textos}>
                <Texto variante="cuerpo" peso="700">
                    {sintoma.tipo}
                </Texto>
                <Texto variante="pequeno" color="textoSecundario">
                    {cuando} · {nivel}
                </Texto>
                {sintoma.observaciones ? (
                    <Texto variante="pequeno" color="textoTenue" numberOfLines={1}>
                        {sintoma.observaciones}
                    </Texto>
                ) : null}
            </View>
            <Icono nombre="siguiente" tamano={22} color={colores.textoTenue} />
        </Pressable>
    );
}

const styles = StyleSheet.create({
    contenedor: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Espacio.m,
        padding: Espacio.m,
        borderWidth: 1.5,
        borderRadius: Radio.m,
    },
    textos: {
        flex: 1,
        minWidth: 0,
        gap: 2,
    },
});