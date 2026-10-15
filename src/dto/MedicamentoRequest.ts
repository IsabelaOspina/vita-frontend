export interface MedicamentoRequest {
  nombre: string;
  dosis?: string | null;
  frecuencia?: string | null;
  viaAdministracion?: string | null;
}
