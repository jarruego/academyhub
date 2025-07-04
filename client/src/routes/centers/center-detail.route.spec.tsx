// NOTA IMPORTANTE:
// El siguiente mock de App.useApp es necesario para evitar errores de 'message.error is not a function' en entorno de test.
// Sin embargo, debido a cómo Ant Design exporta App, puede que siga apareciendo un warning de 'Cannot read properties of undefined (reading error)'.
// Esto NO afecta a la lógica ni a los asserts de los tests, solo al entorno de test. Si Ant Design cambia su export en el futuro, este mock será suficiente.
// Este warning ya no aparece porque el uso de message en el componente está envuelto con un valor por defecto seguro.
vi.mock("antd", async () => {
  const actual = await vi.importActual("antd");
  return {
    ...actual,
    App: {
      ...(actual.App || {}),
      useApp: () => ({
        success: vi.fn(),
        error: vi.fn(),
      }),
    },
  };
});

import { describe, it, beforeEach, expect, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import EditCenterRoute from "./center-detail.route";

const updateCenter = { mutateAsync: vi.fn().mockResolvedValue({}) };
const centerData = {
  id_center: 1,
  employer_number: "EMP123",
  center_name: "Centro Demo",
  id_company: 2,
  contact_person: "Persona Demo",
  contact_phone: "600123123",
  contact_email: "demo@centro.com",
  created_at: new Date(),
  updated_at: new Date(),
};
const companyData = {
  id_company: 2,
  corporate_name: "Empresa Demo"
};

vi.mock("../../hooks/api/centers/use-center.query", () => ({
  useCenterQuery: () => ({ data: centerData, isLoading: false }),
}));
vi.mock("../../hooks/api/centers/use-update-center.mutation", () => ({
  useUpdateCenterMutation: () => updateCenter,
}));
vi.mock("../../hooks/api/centers/use-delete-center.mutation", () => ({
  useDeleteCenterMutation: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("../../hooks/api/companies/use-company.query", () => ({
  useCompanyQuery: () => ({ data: companyData, isLoading: false }),
}));

const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useLocation: () => ({ state: undefined }),
  };
});

describe("<EditCenterRoute />", () => {
  beforeEach(() => {
    cleanup();
    updateCenter.mutateAsync.mockReset();
    render(
      <MemoryRouter initialEntries={["/centers/1"]}>
        <Routes>
          <Route path="/centers/:id_center" element={<EditCenterRoute />} />
        </Routes>
      </MemoryRouter>
    );
  });

  it("debería mostrar los datos del centro", async () => {
    expect((await screen.findByTestId("center-id")).getAttribute("value")).toBe("1");
    expect((await screen.findByTestId("center-name")).getAttribute("value")).toBe("Centro Demo");
    expect((await screen.findByTestId("employer-number")).getAttribute("value")).toBe("EMP123");
    expect((await screen.findByTestId("contact-person")).getAttribute("value")).toBe("Persona Demo");
    expect((await screen.findByTestId("contact-phone")).getAttribute("value")).toBe("600123123");
    expect((await screen.findByTestId("contact-email")).getAttribute("value")).toBe("demo@centro.com");
  });

  it("debería permitir editar y guardar el centro", async () => {
    const nombre = await screen.findByTestId("center-name");
    await userEvent.clear(nombre);
    await userEvent.type(nombre, "Centro Editado");
    const guardar = await screen.findByTestId("save-center");
    await userEvent.click(guardar);
    await waitFor(() => {
      expect(updateCenter.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ center_name: "Centro Editado" })
      );
    });
  });
});
