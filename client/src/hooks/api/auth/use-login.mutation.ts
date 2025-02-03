import { useMutation } from "@tanstack/react-query";
import axios, { AxiosError, AxiosResponse } from "axios";
import { getApiHost } from "../../../utils/api/get-api-host.util";

type Data = {
    username: string;
    password: string;
}

type Response = {token: string, user: object};

export const useLoginMutation = () => useMutation<AxiosResponse<Response>, AxiosError, Data>({
    mutationFn: async (data) => await axios.post<Response>(`${getApiHost()}/auth/login`, data),
});