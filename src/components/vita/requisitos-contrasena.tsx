import { StyleSheet, View } from 'react-native';

import { Espacio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';
import { criteriosContrasena } from '@/utils/politica-contrasena';

import { Icono } from './icono';
import { Texto } from './texto';

/**
 * Lista de lo que debe tener la contraseña. Cada requisito pasa de gris a verde (con su ✓)
 * a medida que se escribe. Con `actual` se agrega "Diferente a tu contraseña actual".
 */
export function RequisitosContrasena({ valor, actual }: { valor: string; actual?: string }) {
    const { colores } = useAccesibilidad();
    const criterios = criteriosContrasena(valor, actual);
    const cumplidos = criterios.filter((c) => c.cumple).length;

    return (
        <View
            style={styles.lista}
            accessible
            accessibilityLabel={
                `Requisitos de la contraseña: ${cumplidos} de ${criterios.length} cumplidos. ` +
                criterios.map((c) => `${c.texto}: ${c.cumple ? 'cumplido' : 'pendiente'}`).join('. ')
            }>
            <Texto variante="pequeno" peso="700" color="textoSecundario">
                Tu contraseña debe tener:
            </Texto>
            {criterios.map((c) => {
                // El verde se usa solo con color normal; en alto contraste se distingue por el ícono y el subrayado
                const color = c.cumple ? colores.exito : colores.textoSecundario;
                return (
                    <View key={c.clave} style={styles.fila}>
                        <Icono nombre={c.cumple ? 'circuloCheck' : 'circulo'} tamano={20} color={color} />
                        <Texto
                            variante="pequeno"
                            peso={c.cumple ? '700' : '400'}
                            style={[styles.texto, { color }, c.cumple && styles.cumplido]}>
                            {c.texto}
                        </Texto>
                    </View>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    lista: {
        gap: Espacio.xs,
    },
    fila: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Espacio.s,
    },
    texto: {
        flexShrink: 1,
    },
    cumplido: {
        textDecorationLine: 'underline',
    },
});