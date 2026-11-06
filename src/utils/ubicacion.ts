import * as Location from 'expo-location';
import { Linking, Platform } from 'react-native';

/** Coordenadas con 6 decimales (unos 10 cm de precisión; el backend guarda hasta 9). */
export type Coordenadas = { latitud: number; longitud: number };

export type UbicacionObtenida =
    | { estado: 'lista'; coordenadas: Coordenadas; direccion: string | null }
    | { estado: 'sinPermiso'; puedePreguntarDeNuevo: boolean }
    | { estado: 'noDisponible' };

/** Cuánto se espera al GPS antes de rendirse (en una emergencia no se puede esperar mucho). */
const ESPERA_GPS_MS = 10_000;

const redondear = (n: number) => Math.round(n * 1e6) / 1e6;

function conTiempoMaximo<T>(promesa: Promise<T>, ms: number): Promise<T | null> {
    return Promise.race([promesa, new Promise<null>((r) => setTimeout(() => r(null), ms))]);
}

/** "Carrera 14 # 20-15, Centro, Armenia" a partir de lo que devuelve el celular. */
async function direccionDe(c: Coordenadas): Promise<string | null> {
    // En el navegador no hay geocodificación inversa: basta con el enlace del mapa
    if (Platform.OS === 'web') return null;
    try {
        const [d] = await conTiempoMaximo(Location.reverseGeocodeAsync({ latitude: c.latitud, longitude: c.longitud }), 5000) ?? [];
        if (!d) return null;
        if (d.formattedAddress) return d.formattedAddress.slice(0, 300);
        const calle = d.street ? [d.street, d.streetNumber].filter(Boolean).join(' # ') : d.name;
        const partes = [calle, d.district, d.city].filter((p, i, todas) => p && todas.indexOf(p) === i);
        return partes.length ? partes.join(', ').slice(0, 300) : null;
    } catch {
        return null;
    }
}

/**
 * Pide permiso (si hace falta) y obtiene la ubicación actual del celular, con la dirección
 * aproximada si el celular la puede calcular. Si la persona no da permiso, no se insiste.
 */
export async function obtenerUbicacionActual(): Promise<UbicacionObtenida> {
    try {
        const permiso = await Location.requestForegroundPermissionsAsync();
        if (permiso.status !== 'granted') {
            return { estado: 'sinPermiso', puedePreguntarDeNuevo: permiso.canAskAgain };
        }

        // Primero la última conocida (es instantánea); si es vieja o no hay, la actual
        let posicion = await Location.getLastKnownPositionAsync({ maxAge: 2 * 60_000, requiredAccuracy: 200 }).catch(() => null);
        if (!posicion) {
            posicion = await conTiempoMaximo(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), ESPERA_GPS_MS).catch(() => null);
        }
        if (!posicion) return { estado: 'noDisponible' };

        const coordenadas = { latitud: redondear(posicion.coords.latitude), longitud: redondear(posicion.coords.longitude) };
        return { estado: 'lista', coordenadas, direccion: await direccionDe(coordenadas) };
    } catch {
        // GPS apagado, navegador sin soporte, etc.
        return { estado: 'noDisponible' };
    }
}

/** Enlace de Google Maps, el mismo formato que envía el backend en el SMS. */
export function enlaceMapa(c: Coordenadas): string {
    return `https://maps.google.com/?q=${c.latitud},${c.longitud}`;
}

/** Abre los ajustes de VITA en el celular (cuando el permiso se negó para siempre). */
export function abrirAjustesUbicacion() {
    void Linking.openSettings().catch(() => undefined);
}