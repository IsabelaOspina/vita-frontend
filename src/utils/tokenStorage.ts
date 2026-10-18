import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const TOKEN_KEY = "vita_token";
/** El rol de la cuenta (USUARIO, PERSONAL_SALUD o ADMIN), para abrir la app de una vez en su pantalla. */
const ROL_KEY = "vita_rol";

// SecureStore solo existe en Android e iOS. En el navegador (al probar con la tecla "w")
// se usa localStorage, que no es seguro, pero solo sirve para pruebas en web.
const esWeb = Platform.OS === "web";

export async function guardarToken(token: string): Promise<void> {
  if (esWeb) {
    localStorage.setItem(TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function obtenerToken(): Promise<string | null> {
  if (esWeb) {
    return localStorage.getItem(TOKEN_KEY);
  }
  return await SecureStore.getItemAsync(TOKEN_KEY);
}

export async function eliminarToken(): Promise<void> {
  if (esWeb) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ROL_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(ROL_KEY);
}

export async function guardarRol(rol: string): Promise<void> {
  if (esWeb) {
    localStorage.setItem(ROL_KEY, rol);
    return;
  }
  await SecureStore.setItemAsync(ROL_KEY, rol);
}

export async function obtenerRol(): Promise<string | null> {
  if (esWeb) {
    return localStorage.getItem(ROL_KEY);
  }
  return await SecureStore.getItemAsync(ROL_KEY);
}

/**
 * true si el token ya venció, según la fecha de vencimiento que trae adentro (sin consultar al servidor).
 * Si no se puede leer, se deja que el backend decida (devuelve false).
 */
export function tokenVencido(token: string): boolean {
  // Si el celular no puede leer el token, se deja que el backend decida (no se cierra la sesión)
  if (typeof atob !== "function") return false;
  try {
    const parte = token.split(".")[1];
    const base64 = parte.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(parte.length / 4) * 4, "=");
    const { exp } = JSON.parse(atob(base64)) as { exp?: number };
    return typeof exp === "number" && exp * 1000 <= Date.now();
  } catch {
    return false;
  }
}