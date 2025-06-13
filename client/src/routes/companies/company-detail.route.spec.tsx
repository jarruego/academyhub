import { beforeEach, describe, expect, it, vi } from "vitest";
import CompanyDetailRoute from "./company-detail.route";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("../../hooks/api/companies/use-company.query", () => ({
  useCompanyQuery: () => ({ data: {
    id_company: 1,
    company_name: "Empresa Test",
    corporate_name: "Empresa Test S.A.",
    cif: "B12345678",
    created_at: new Date(),
    updated_at: new Date(),
  }, isLoading: false }),
}));

vi.mock("../../hooks/api/companies/use-update-company.mutation", () => ({
  useUpdateCompanyMutation: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("../../hooks/api/companies/use-delete-company.mutation", () => ({
  useDeleteCompanyMutation: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("../../hooks/api/centers/use-centers.query", () => ({
  useCentersQuery: () => ({ data: [], isLoading: false }),
}));

describe.skip("<CompanyDetailRoute/>", () => {
  beforeEach(() => {
    cleanup();
    render(
      <MemoryRouter>
        <CompanyDetailRoute />
      </MemoryRouter>
    );
  });

  it("should render company data", async () => {
    expect((await screen.findByTestId("company_name")).getAttribute("value")).toBe("Empresa Test");
    expect((await screen.findByTestId("corporate_name")).getAttribute("value")).toBe("Empresa Test S.A.");
    expect((await screen.findByTestId("cif")).getAttribute("value")).toBe("B12345678");
  });
  
});
