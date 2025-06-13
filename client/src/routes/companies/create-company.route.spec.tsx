import { beforeEach, describe, expect, it, vi } from "vitest";
import CreateCompanyRoute from "./create-company.route";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";

const create = {
    mutate: vi.fn(),
}

vi.spyOn(create, 'mutate');

vi.mock("../../hooks/api/companies/use-create-company.mutation", () => ({
    useCreateCompanyMutation: () => ({
        mutateAsync: create.mutate,
    })
}));

describe('<CreateCompanyRoute/>', () => {
    beforeEach(() => {
        render(
            <MemoryRouter>
                <CreateCompanyRoute/>
            </MemoryRouter>
        );
    });

    it('should create a company', async () => {
        // Referencia a los campos input
        const companyName = screen.getByTestId("company-name");
        const corporateName = screen.getByTestId("corporate-name");
        const cif = screen.getByTestId("cif");
        const submit = screen.getByTestId("submit");

        // Rellenar datos correctos
        await userEvent.type(companyName, 'test name');
        await userEvent.type(corporateName, 'test corp name');
        await userEvent.type(cif, 'B61900031');

        await userEvent.click(submit);

        // Testeo
        expect(create.mutate).toHaveBeenCalled();
    });
});