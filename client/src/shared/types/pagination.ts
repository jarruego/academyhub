// Tipos compartidos para paginación que coinciden con el backend
export interface PaginationParams {
    page?: number;
    limit?: number;
    search?: string;
}

export interface PaginationResult<T> {
    data: T[]; // Campo genérico para cualquier entidad
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}