import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";
import { getApiHost } from "../../../utils/api/get-api-host.util";

export interface MoodleUser {
  id_moodle_user: number;
  id_user: number;
  moodle_id: number;
  moodle_username: string;
  moodle_password?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const useMoodleUsersByUserIdQuery = (userId: number) => {
  const request = useAuthenticatedAxios();

  return useQuery({
    queryKey: ['moodle-users', userId],
    queryFn: async (): Promise<MoodleUser[]> => {
      const response = await request({
        method: 'GET',
        url: `${getApiHost()}/moodle-user/by-user/${userId}`,
      });
      return response.data as MoodleUser[];
    },
    enabled: !!userId,
  });
};