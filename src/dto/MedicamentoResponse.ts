export interface MedicamentoResponse {
  id: number;
  nombre: string;
  dosis: string | null;
  viaAdministracion: string | null;
  activo: boolean;
}