import { StyleSheet, View } from 'react-native';

import { Espacio, Radio } from '@/constants/vita-theme';
import { useAccesibilidad } from '@/context/accesibilidad-context';
import type { SintomaResumenResponse } from '@/dto/SintomaResumenResponse';
import { decimal } from '@/utils/sintomas';

import { Texto } from './texto';

/** Un indicador grande: "12 registros". */
function Indicador({ valor, etiqueta }: { valor: string; etiqueta: string }) {
    const { colores } = useAccesibilidad();
    return (
        <View
            accessible
            accessibilityLabel={`${valor} ${etiqueta}`}
            style={[styles.indicador, { backgroundColor: colores.superficieSuave, borderColor: colores.borde }]}>
            <Texto variante="subtitulo" color="primario" peso="800">
                {valor}
            </Texto>
            <Texto variante="pequeno" color="textoSecundario" centrado>
                {etiqueta}
            </Texto>
        </View>
    );
}

/** Indicadores de los últimos 30 días: registros, días con registro, intensidad promedio y los síntomas más frecuentes. */
export function ResumenSintomas({ resumen }: { resumen: SintomaResumenResponse }) {
    const { colores } = useAccesibilidad();
    const frecuentes = [...resumen.porTipo].sort((a, b) => b.cantidad - a.cantidad).slice(0, 3);

    return (
        <View style={styles.contenedor}>
            <View style={styles.indicadores}>
                <Indicador valor={String(resumen.totalRegistros)} etiqueta={resumen.totalRegistros === 1 ? 'registro' : 'registros'} />
                <Indicador valor={String(resumen.diasConRegistro)} etiqueta={resumen.diasConRegistro === 1 ? 'día' : 'días'} />
                <Indicador valor={decimal(resumen.intensidadPromedio)} etiqueta="promedio" />
            </View>

            {/* La frase que arma el backend, la misma que lee VITA en voz alta */}
            <View style={[styles.lectura, { borderLeftColor: colores.primario, backgroundColor: colores.fondo }]}>
                <Texto variante="etiqueta" peso="400" color="textoSecundario">
                    {resumen.textoLectura}
                </Texto>
            </View>

            {frecuentes.map((t) => (
                <View
                    key={t.tipo}
                    accessible
                    accessibilityLabel={`${t.tipo}: ${t.cantidad} ${t.cantidad === 1 ? 'vez' : 'veces'}, promedio ${decimal(t.intensidadPromedio)}, la última fue ${t.ultimaIntensidad}`}
                    style={[styles.tipo, { borderColor: colores.borde }]}>
                    <Texto variante="cuerpo" peso="700">
                        {t.tipo}
                    </Texto>
                    <Texto variante="pequeno" color="textoSecundario">
                        {t.cantidad} {t.cantidad === 1 ? 'vez' : 'veces'} · promedio {decimal(t.intensidadPromedio)} · última: {t.ultimaIntensidad}
                    </Texto>
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    contenedor: {
        gap: Espacio.m,
    },
    indicadores: {
        flexDirection: 'row',
        gap: Espacio.s,
    },
    indicador: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: Espacio.m,
        paddingHorizontal: Espacio.xs,
        borderRadius: Radio.m,
        borderWidth: 1,
    },
    lectura: {
        borderLeftWidth: 4,
        borderRadius: Radio.s,
        padding: Espacio.m,
    },
    tipo: {
        borderWidth: 1.5,
        borderRadius: Radio.m,
        paddingVertical: Espacio.s,
        paddingHorizontal: Espacio.m,
    },
});