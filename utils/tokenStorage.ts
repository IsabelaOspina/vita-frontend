import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const TOKEN_KEY = "vita_token";

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
    return;
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}