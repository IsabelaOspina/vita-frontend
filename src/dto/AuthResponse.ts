
import type { UsuarioResponse } from "./UsuarioResponse";

export interface AuthResponse {
  token: string;
  tipo: string;
  usuario: UsuarioResponse;
}
