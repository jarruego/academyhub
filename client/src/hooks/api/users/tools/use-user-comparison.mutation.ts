import { useQuery } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface UserMatch {
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
    firstname: string;
    lastname: string;
    email: string;
    username: string;
  };
  matchType: 'exact_dni' | 'email_and_name' | 'email_only' | 'name_only';
  similarity: number;
  confidence: 'high' | 'medium' | 'low';
}

interface UserComparison {
  exactMatches: UserMatch[];
  probableMatches: UserMatch[];
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
      firstname: string;
      lastname: string;
      email: string;
      username: string;
    }>;
  };
}

interface LinkUsersPayload {
  bdUserId: number;
  moodleUserId: number;
}

export const useUserComparison = () => {
  return useQuery<UserComparison>({
    queryKey: ['user-comparison'],
    queryFn: async () => {
      const response = await fetch('/api/user-comparison/compare');
      if (!response.ok) {
        throw new Error('Failed to fetch user comparison');
      }
      return response.json();
    },
  });
};

export const useLinkUsers = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: LinkUsersPayload) => {
      const response = await fetch('/api/user-comparison/link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to link users');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidar la query de comparación para refrescar los datos
      queryClient.invalidateQueries({ queryKey: ['user-comparison'] });
    },
  });
};