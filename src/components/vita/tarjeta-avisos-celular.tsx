import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Platform } from 'react-native';

import { Aviso } from './aviso';
import { Boton } from './boton';
import { Tarjeta } from './tarjeta';
import { permisoDeAvisos } from './vigilante-recordatorios';

/** Abre los ajustes de VITA en el celular, donde se activan las notificaciones. */
export function abrirAjustesDelCelular() {
    void Linking.openSettings().catch(() => undefined);
}

/** Si las notificaciones de VITA están bloqueadas en el celular (se revisa cada vez que se entra a la pantalla). */
export function useAvisosBloqueados(activo: boolean): boolean {
    const [bloqueados, setBloqueados] = useState(false);
    useFocusEffect(
        useCallback(() => {
            if (!activo) return;
            void permisoDeAvisos().then((p) => setBloqueados(p === 'negado'));
        }, [activo]),
    );
    return bloqueados;
}

/**
 * Solo aparece si las notificaciones de VITA están bloqueadas en el celular: sin ellas, los
 * recordatorios no llegan cuando VITA está cerrada. Lleva a los ajustes para activarlas.
 */
export function TarjetaAvisosBloqueados({ bloqueados }: { bloqueados: boolean }) {
    if (Platform.OS === 'web' || !bloqueados) return null;
    return (
        <Tarjeta titulo="Recordatorios" icono="campana">
            <Aviso tipo="error" mensaje="Las notificaciones de VITA están desactivadas. Actívalas para que tus recordatorios te lleguen aunque VITA esté cerrada." />
            <Boton titulo="Activar notificaciones" icono="ajustes" onPress={abrirAjustesDelCelular} pista="Abre los ajustes de VITA en el celular" />
        </Tarjeta>
    );
}