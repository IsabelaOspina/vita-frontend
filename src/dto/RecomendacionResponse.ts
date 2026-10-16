export interface RecomendacionResponse {
  id: number;
  mensaje: string;
  profesionalId: number;
  profesionalNombre: string;
  especialidad: string | null;
  pacienteId: number;
  sintomaId: number | null;
  sintomaReferencia: string | null;
  fechaCreacion: string;
  leida: boolean;
  fechaLectura: string | null;
  textoLectura: string;
}
