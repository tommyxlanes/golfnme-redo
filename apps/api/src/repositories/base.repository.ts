/**
 * Base Repository Interface
 * Defines common CRUD operations for all repositories
 */
export interface IBaseRepository<T, CreateInput, UpdateInput> {
  findById(id: string): Promise<T | null>
  findMany(options?: FindManyOptions): Promise<T[]>
  create(data: CreateInput): Promise<T>
  update(id: string, data: UpdateInput): Promise<T>
  delete(id: string): Promise<void>
  count(where?: Record<string, any>): Promise<number>
}

export interface FindManyOptions {
  where?: Record<string, any>
  orderBy?: Record<string, 'asc' | 'desc'>
  take?: number
  skip?: number
  include?: Record<string, any>
}

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}
