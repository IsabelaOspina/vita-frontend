import { apiRequest } from "./api";
import { obtenerToken } from "../utils/tokenStorage";

import type { MedicamentoRequest } from "../dto/MedicamentoRequest";
import type { MedicamentoResponse } from "../dto/MedicamentoResponse";

// Medicamentos del usuario que inició sesión.

async function obtenerTokenRequerido(): Promise<string> {
  const token = await obtenerToken();

  if (!token) {
    throw new Error("Debes iniciar sesión para realizar esta operación.");
  }

  return token;
}

// Registrar un medicamento
export async function crearMedicamento(
  medicamento: MedicamentoRequest
): Promise<MedicamentoResponse> {
  const token = await obtenerTokenRequerido();

  return await apiRequest<MedicamentoResponse>(
    "/api/medicamentos",
    "POST",
    medicamento,
    token
  );
}

// Listar los medicamentos
export async function listarMedicamentos(): Promise<MedicamentoResponse[]> {
  const token = await obtenerTokenRequerido();

  return await apiRequest<MedicamentoResponse[]>(
    "/api/medicamentos",
    "GET",
    undefined,
    token
  );
}

// Consultar un medicamento
export async function obtenerMedicamento(
  id: number
): Promise<MedicamentoResponse> {
  const token = await obtenerTokenRequerido();

  return await apiRequest<MedicamentoResponse>(
    `/api/medicamentos/${id}`,
    "GET",
    undefined,
    token
  );
}

// Editar un medicamento
export async function actualizarMedicamento(
  id: number,
  medicamento: MedicamentoRequest
): Promise<MedicamentoResponse> {
  const token = await obtenerTokenRequerido();

  return await apiRequest<MedicamentoResponse>(
    `/api/medicamentos/${id}`,
    "PUT",
    medicamento,
    token
  );
}

// Desactivar un medicamento (el backend lo conserva con activo = false)
export async function desactivarMedicamento(id: number): Promise<void> {
  const token = await obtenerTokenRequerido();

  await apiRequest<void>(
    `/api/medicamentos/${id}`,
    "DELETE",
    undefined,
    token
  );
}
