import { StyleSheet, View } from 'react-native';

import { Espacio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';

import { Icono, type NombreIcono } from './icono';
import { Texto } from './texto';

type Props = {
    etiqueta: string;
    valor: string;
    icono: NombreIcono;
};

/** Un dato de una ficha: ícono, nombre del dato y valor ("Correo · maria@vita.com"). */
export function FilaDato({ etiqueta, valor, icono }: Props) {
    const { colores } = useAccesibilidad();

    return (
        // El lector de pantalla lo lee como una sola frase: "Correo: maria@vita.com"
        <View style={styles.fila} accessible accessibilityLabel={`${etiqueta}: ${valor}`}>
            <Icono nombre={icono} tamano={22} color={colores.primario} />
            <View style={styles.textos}>
                <Texto variante="pequeno" color="textoSecundario">
                    {etiqueta}
                </Texto>
                <Texto variante="cuerpo" peso="600">
                    {valor}
                </Texto>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    fila: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Espacio.m,
    },
    textos: {
        flex: 1,
        minWidth: 0,
    },
});