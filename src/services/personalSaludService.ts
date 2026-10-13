import { apiRequest } from "./api";
import { obtenerToken } from "../utils/tokenStorage";
import type { AsignacionResponse } from "../dto/AsignacionResponse";

export async function consultarMisPacientes(): Promise<AsignacionResponse[]> {
  const token = await obtenerToken();

  if (!token) {
    throw new Error("Debes iniciar sesión para consultar tus pacientes.");
  }

  return await apiRequest<AsignacionResponse[]>(
    "/api/personal-salud/me/pacientes",
    "GET",
    undefined,
    token
  );
}
