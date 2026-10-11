
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "vita_token";

export async function guardarToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function obtenerToken(): Promise<string | null> {
  return await SecureStore.getItemAsync(TOKEN_KEY);
}

export async function eliminarToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
