import { useMutation } from "@tanstack/react-query";
import axios, { AxiosError, AxiosResponse } from "axios";
import { getApiHost } from "../../../utils/api/get-api-host.util";

type Data = {
    username: string;
    password: string;
}

export enum Role {
    ADMIN = 'admin',
    TUTOR = 'tutor',
    VIEWER = 'viewer'
}

export type UserModel = {
        createdAt: Date;
        updatedAt: Date;
        id: number;
        name: string;
        lastName: string;
        email: string;
        username: string;
        role: Role;
}

type Response = {token: string, user: UserModel };

export const useLoginMutation = () => useMutation<AxiosResponse<Response>, AxiosError, Data>({
    mutationFn: async (data) => await axios.post<Response>(`${getApiHost()}/auth/login`, data),
});