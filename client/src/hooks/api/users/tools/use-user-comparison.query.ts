import { useQuery } from '@tanstack/react-query';
import { useAuthenticatedAxios } from '../../../../utils/api/use-authenticated-axios.util';
import { getApiHost } from '../../../../utils/api/get-api-host.util';

export interface UserMatch {
  bdUser: {
    id_user: number;
    name: string;
    first_surname?: string;
    second_surname?: string;
    email?: string;
    dni?: string;
  };
  moodleUser: {
    id: number;
    username: string;
    firstname: string;
    lastname: string;
    fullname: string;
    email: string;
  };
  matchType: 'exact_dni' | 'email_and_name' | 'email_only' | 'name_only';
  similarity: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface LinkedUserPair {
  bdUser: {
    id_user: number;
    name: string;
    first_surname?: string;
    second_surname?: string;
    email?: string;
    dni?: string;
  };
  moodleUser: {
    id: number;
    username: string;
    firstname: string;
    lastname: string;
    fullname: string;
    email: string;
  };
  linkedAt?: string; // Fecha de vinculación
}

export interface UserComparison {
  exactMatches: UserMatch[];
  probableMatches: UserMatch[];
  linkedUsers: LinkedUserPair[]; // Nueva propiedad
  unmatched: {
    bdUsers: Array<{
      id_user: number;
      name: string;
      first_surname?: string;
      second_surname?: string;
      email?: string;
      dni?: string;
    }>;
    moodleUsers: Array<{
      id: number;
      username: string;
      firstname: string;
      lastname: string;
      fullname: string;
      email: string;
    }>;
  };
}

export const useUserComparison = () => {
  const request = useAuthenticatedAxios<UserComparison>();

  return useQuery<UserComparison>({
    queryKey: ['user-comparison'],
    queryFn: async () => {
      const response = await request({
        url: `${getApiHost()}/user-comparison/compare`,
        method: 'GET'
      });
      return response.data;
    },
    staleTime: 30 * 1000, // Reducido a 30 segundos
    refetchOnWindowFocus: true, // Refrescar cuando se enfoque la ventana
    refetchInterval: 60 * 1000, // Refrescar cada minuto automáticamente
  });
};