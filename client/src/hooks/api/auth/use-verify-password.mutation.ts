import { useMutation } from "@tanstack/react-query";
import { getApiHost } from "../../../utils/api/get-api-host.util";
import { useAuthenticatedAxios } from "../../../utils/api/use-authenticated-axios.util";

/** Reverifica la contraseña del usuario ya conectado — ver ConfirmPasswordModal. */
export function useVerifyPasswordMutation() {
  const request = useAuthenticatedAxios<{ ok: true }>();
  return useMutation({
    mutationFn: async (password: string) => (await request({ method: "POST", url: `${getApiHost()}/auth/verify-password`, data: { password } })).data,
  });
}
