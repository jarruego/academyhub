import { beforeEach, describe, expect, it, vi } from "vitest";
import CreateUserRoute from "./create-user.route";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";

const create = {
    mutate: vi.fn(),
};

vi.spyOn(create, "mutate");

vi.mock("../../hooks/api/users/use-create-user.mutation", () => ({
    useCreateUserMutation: () => ({
        mutateAsync: create.mutate,
    }),
}));

describe("<CreateUserRoute/>", () => {
    beforeEach(() => {
        cleanup();
        render(
            <MemoryRouter>
                <CreateUserRoute />
            </MemoryRouter>
        );
        create.mutate.mockReset();
    });

    describe("when submitting valid data", () => {
        it("should call the mutation to create the user", async () => {
            const name = await screen.findByTestId("name");
            const firstSurname = await screen.findByTestId("first-surname");
            const secondSurname = await screen.findByTestId("second-surname");
            const email = await screen.findByTestId("email");
            const dni = await screen.findByTestId("dni");
            const phone = await screen.findByTestId("phone");
            const address = await screen.findByTestId("address");
            const country = await screen.findByTestId("country");
            const province = await screen.findByTestId("province");
            const city = await screen.findByTestId("city");
            const postalCode = await screen.findByTestId("postal-code");
            const professionalCategory = await screen.findByTestId("professional-category");
            const educationLevel = await screen.findByTestId("education-level");
            const nss = await screen.findByTestId("nss");
            const submit = await screen.findByTestId("submit");

            await userEvent.type(name, "Juan");
            await userEvent.type(firstSurname, "Pérez");
            await userEvent.type(secondSurname, "Gómez");
            await userEvent.type(email, "juan@email.com");
            await userEvent.type(dni, "12345678Z");
            await userEvent.type(phone, "123456789");
            await userEvent.type(address, "Calle Falsa 123");
            await userEvent.type(country, "España");
            await userEvent.type(province, "Madrid");
            await userEvent.type(city, "Madrid");
            await userEvent.type(postalCode, "28080");
            await userEvent.type(professionalCategory, "Ingeniero");
            await userEvent.type(educationLevel, "Universitario");
            await userEvent.type(nss, "123456789");
            await userEvent.click(submit);

            expect(create.mutate).toHaveBeenCalled();
        });
    });

    describe("when submitting invalid data", () => {
        it("should not submit if required fields are empty", async () => {
            const submit = await screen.findByTestId("submit");
            await userEvent.click(submit);
            expect(create.mutate).not.toHaveBeenCalled();
        });

        it("should not submit if required fields are invalid", async () => {
            const dni = await screen.findByTestId("dni");
            const name = await screen.findByTestId("name");
            const firstSurname = await screen.findByTestId("first-surname");
            const email = await screen.findByTestId("email");
            const submit = await screen.findByTestId("submit");

            await userEvent.clear(dni);
            await userEvent.type(dni, "1234");
            await userEvent.clear(name);
            await userEvent.clear(firstSurname);
            await userEvent.clear(email);
            await userEvent.type(email, "no-es-email");
            await userEvent.click(submit);

            expect(create.mutate).not.toHaveBeenCalled();
        });
    });
});