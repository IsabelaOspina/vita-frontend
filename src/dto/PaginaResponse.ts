export interface PaginaResponse<T> {
    contenido: T[];
    pagina: number;
    tamano: number;
    totalElementos: number;
    totalPaginas: number;
    ultima: boolean;
}