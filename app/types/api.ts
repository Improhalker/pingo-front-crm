export interface ApiData<T> {
  data: T
}
export interface PublicError {
  message?: string
  code?: string
  errors?: Record<string, string[]>
  request_id?: string
}
export interface Organization {
  id: string
  name: string
  timezone: string
  role: 'ADMIN' | 'OPERATOR'
  /** Set by the platform; a suspended organization cannot be opened. */
  suspended?: boolean
}
export type CompanyAccess =
  'ok' | 'none' | 'multiple' | 'suspended' | 'platform'
export interface SessionUser {
  id: string
  name: string
  email: string
  /** Informational only: the backend authorizes every platform operation. */
  is_platform_administrator: boolean
  /** Server-resolved company access (ADR-028): one company per client account. */
  access: CompanyAccess
  /** The single company of this account (also when suspended); null for none/multiple/platform. */
  organization: Organization | null
  organizations: Organization[]
}
export interface PlatformOrganization {
  id: string
  name: string
  timezone: string
  status: 'ACTIVE' | 'SUSPENDED'
  suspended_at: string | null
  members_count: number | null
  created_at: string | null
  updated_at: string | null
  first_administrator: { id: string; name: string; email: string } | null
}
export interface PlatformMember {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'OPERATOR'
  joined_at: string | null
  /** Deleting the company also deletes this account (it has no other access). */
  only_in_this_organization: boolean
  /** Legacy link to more than one company: the account cannot sign in until it is resolved (ADR-028). */
  has_other_organizations: boolean
}
export interface PlatformOrganizationDetail extends PlatformOrganization {
  members: PlatformMember[]
}
export interface PlatformListFilters {
  search: string
  status: '' | 'active' | 'suspended'
}
export interface NewAdministratorInput {
  name: string
  email: string
  password: string
  password_confirmation: string
}
export interface PageMeta {
  current_page: number
  last_page: number
  per_page: number
  total: number
}
export interface Paginated<T> {
  data: T[]
  meta: PageMeta
}
export interface ProvisionOrganizationInput {
  organization: { name: string; timezone: string }
  administrator: {
    name: string
    email: string
    password: string
    password_confirmation: string
  }
}
export interface Health {
  status: 'ready' | 'degraded' | 'unavailable'
  checks: { application: string; mysql: string; redis: string }
}
