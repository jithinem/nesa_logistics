export interface PaginationMetadata {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: PaginationMetadata;
}

export const createPaginationMetadata = (
  page: number,
  limit: number,
  totalItems: number,
): PaginationMetadata => ({
  page,
  limit,
  totalItems,
  totalPages: Math.ceil(totalItems / limit),
});
