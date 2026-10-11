import { StyleSheet, View } from 'react-native';

import { Radio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';

import { Icono } from './icono';
import { Texto } from './texto';

/** Logo de VITA: corazón dentro de un círculo + nombre. */
export function LogoVita({ compacto = false }: { compacto?: boolean }) {
    const { colores, altoContraste } = useAccesibilidad();
    const diametro = compacto ? 44 : 76;

    return (
        <View style={[styles.contenedor, compacto && styles.fila]} accessible accessibilityRole="header" accessibilityLabel="VITA">
            <View
                style={[
                    styles.circulo,
                    {
                        width: diametro,
                        height: diametro,
                        backgroundColor: colores.primario,
                        shadowColor: colores.primario,
                    },
                    !altoContraste && styles.sombra,
                ]}>
                <Icono nombre="corazon" tamano={diametro * 0.5} color={colores.sobrePrimario} />
                <View
                    style={[
                        styles.punto,
                        {
                            backgroundColor: colores.acento,
                            borderColor: altoContraste ? colores.fondo : colores.superficie,
                            width: diametro * 0.26,
                            height: diametro * 0.26,
                        },
                    ]}
                />
            </View>
            <Texto variante={compacto ? 'subtitulo' : 'titulo'} peso="800" style={{ letterSpacing: 3 }}>
                VITA
            </Texto>
        </View>
    );
}

const styles = StyleSheet.create({
    contenedor: {
        alignItems: 'center',
        gap: 10,
    },
    fila: {
        flexDirection: 'row',
    },
    circulo: {
        borderRadius: Radio.total,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sombra: {
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 18,
        elevation: 8,
    },
    punto: {
        position: 'absolute',
        top: 2,
        right: 2,
        borderRadius: Radio.total,
        borderWidth: 3,
    },
});