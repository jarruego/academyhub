import { beforeEach, describe, expect, it, vi } from "vitest";
import CreateCompanyRoute from "./create-company.route";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";

const create = {
    mutate: vi.fn(),
};

vi.spyOn(create, "mutate");

vi.mock("../../hooks/api/companies/use-create-company.mutation", () => ({
    useCreateCompanyMutation: () => ({
        mutateAsync: create.mutate,
    }),
}));

describe("<CreateCompanyRoute/>", () => {
    beforeEach(() => {
        cleanup();
        render(
            <MemoryRouter>
                <CreateCompanyRoute />
            </MemoryRouter>
        );
        create.mutate.mockReset();
    });

    describe("when submitting valid data", () => {
        it("should call the mutation to create the company", async () => {
            const companyName = await screen.findByTestId("company-name");
            const corporateName = await screen.findByTestId("corporate-name");
            const cif = await screen.findByTestId("cif");
            const submit = await screen.findByTestId("submit");

            await userEvent.type(companyName, "Test Company");
            await userEvent.type(corporateName, "Test Corp S.A.");
            await userEvent.type(cif, "B61900031");
            await userEvent.click(submit);

            expect(create.mutate).toHaveBeenCalled();
        });
    });

    describe("when submitting invalid data", () => {
        it("should not submit if fields are empty", async () => {
            const submit = await screen.findByTestId("submit");
            await userEvent.click(submit);

            expect(create.mutate).not.toHaveBeenCalled();
        });

        it("should show error for invalid CIF", async () => {
            const companyName = await screen.findByTestId("company-name");
            const corporateName = await screen.findByTestId("corporate-name");
            const cif = await screen.findByTestId("cif");
            const submit = await screen.findByTestId("submit");

            await userEvent.type(companyName, "Test Company");
            await userEvent.type(corporateName, "Test Corp S.A.");
            await userEvent.type(cif, "123ABC"); // invalid CIF
            await userEvent.click(submit);

            expect(create.mutate).not.toHaveBeenCalled();
        });
    });
});