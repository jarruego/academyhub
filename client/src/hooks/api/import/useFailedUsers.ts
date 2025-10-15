import { useQuery } from '@tanstack/react-query'
import { useAuthInfo } from '../../../providers/auth/auth.context'

interface FailedUser {
  id: number
  dni: string
  name: string
  first_surname: string
  second_surname?: string
  email?: string
  import_id: string
  nss?: string
  company_name: string
  center_name: string
  failure_reason: string
  import_source: string
  created_at: string
}

interface FailedUsersResponse {
  users: FailedUser[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

interface FailedUsersStats {
  total: number
  companies: number
  centers: number
  uniqueErrors: number
  errorBreakdown: Array<{
    failure_reason: string
    count: number
  }>
}

export const useFailedUsers = (page: number = 1, limit: number = 50) => {
  const { authInfo } = useAuthInfo()

  return useQuery<FailedUsersResponse>({
    queryKey: ['failed-users', page, limit],
    queryFn: async () => {
      if (!authInfo?.token) {
        throw new Error('No hay token de autenticación')
      }

      const response = await fetch(`/api/import/failed-users?page=${page}&limit=${limit}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authInfo.token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`)
      }

      return await response.json()
    },
    staleTime: 30000, // 30 segundos
    enabled: !!authInfo?.token,
  })
}

export const useFailedUsersStats = () => {
  const { authInfo } = useAuthInfo()

  return useQuery<FailedUsersStats>({
    queryKey: ['failed-users-stats'],
    queryFn: async () => {
      if (!authInfo?.token) {
        throw new Error('No hay token de autenticación')
      }

      const response = await fetch('/api/import/failed-users/stats', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authInfo.token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`)
      }

      return await response.json()
    },
    staleTime: 60000, // 1 minuto
    enabled: !!authInfo?.token,
  })
}