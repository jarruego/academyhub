import { beforeEach, describe, expect, it, vi } from "vitest";
import CreateCenterRoute from "./create-center.route";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";

const create = {
    mutate: vi.fn(),
};

vi.spyOn(create, "mutate");

vi.mock("../../hooks/api/centers/use-create-center.mutation", () => ({
    useCreateCenterMutation: () => ({
        mutateAsync: create.mutate,
    }),
}));

vi.mock("antd", async () => {
  const antd = (await vi.importActual("antd")) as typeof import("antd");
  return {
    ...antd,
    App: {
      ...antd.App,
      useApp: () => ({
        message: {
          success: vi.fn(),
          error: vi.fn(),
        },
      }),
    },
  };
});

describe("<CreateCenterRoute/>", () => {
    beforeEach(() => {
        cleanup();
        render(
            <MemoryRouter>
                <CreateCenterRoute />
            </MemoryRouter>
        );
        create.mutate.mockReset();
    });

    describe("when submitting valid data", () => {
        it("should call the mutation to create the center", async () => {
            const centerName = await screen.findByTestId("center-name");
            const employerNumber = await screen.findByTestId("employer-number");
            const contactPerson = await screen.findByTestId("contact-person");
            const contactPhone = await screen.findByTestId("contact-phone");
            const contactEmail = await screen.findByTestId("contact-email");
            const submit = await screen.findByTestId("submit");

            await userEvent.type(centerName, "Centro Test");
            await userEvent.type(employerNumber, "12345");
            await userEvent.type(contactPerson, "Juan Perez");
            await userEvent.type(contactPhone, "600123123");
            await userEvent.type(contactEmail, "test@email.com");
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

        it("should show error for invalid email", async () => {
            const centerName = await screen.findByTestId("center-name");
            const contactEmail = await screen.findByTestId("contact-email");
            const submit = await screen.findByTestId("submit");

            await userEvent.type(centerName, "Centro Test");
            await userEvent.type(contactEmail, "no-es-email");
            await userEvent.click(submit);

            expect(create.mutate).not.toHaveBeenCalled();
            expect(await screen.findByText("El email no es válido")).toBeDefined();
        });
    });
});
