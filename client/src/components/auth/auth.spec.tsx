import { beforeEach, describe, expect, it, vi } from "vitest";
import AuthPage from "./auth.page";
import { render, screen } from "@testing-library/react";
import { userEvent } from '@testing-library/user-event'

const login = {
    mutation: vi.fn(() => ({
        data: {}
    }))
};

vi.spyOn(login, "mutation");

vi.mock("../../hooks/api/auth/use-login.mutation", () => ({
    useLoginMutation: () => ({
        mutateAsync: login.mutation,
        isPending: false,
        error: undefined
    })
}));

describe('<AuthPage/>', () => {
    beforeEach(() => {
        render(<AuthPage setInfo={() => {}}/>);
    });

    it('should send login data', async () => {
        /* Recogemos las referencias a los componentes */
        const user = await screen.findByPlaceholderText("Username");
        const password = await screen.findByPlaceholderText("Password");
        const submit = await screen.findByText("Submit");

        /* Rellenamos los campos del formulario con datos falsos */
        await userEvent.type(user, "john.doe");
        await userEvent.type(password, "Admin1234");

        /* Testear que los elementos existen */
        expect(user).toBeDefined();
        expect(password).toBeDefined();
        expect(submit).toBeDefined();

        /* Click en el botón */
        await userEvent.click(submit);

        expect(login.mutation).toHaveBeenCalled();
        expect(login.mutation).toHaveBeenCalledWith({
            password: "Admin1234",
            username: "john.doe"
        });
    });
});