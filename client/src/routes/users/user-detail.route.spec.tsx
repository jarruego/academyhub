import { describe, it, beforeEach, expect, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import UserDetailRoute from "./user-detail.route";

const updateUser = { mutateAsync: vi.fn().mockResolvedValue({}) };
const userData = {
  id_user: 1,
  name: "Usuario Demo",
  first_surname: "Apellido1",
  email: "demo@user.com",
  phone: "600111222",
};

vi.mock("../../hooks/api/users/use-user.query", () => ({
  useUserQuery: () => ({ data: userData, isLoading: false }),
}));
vi.mock("../../hooks/api/users/use-update-user.mutation", () => ({
  useUpdateUserMutation: () => updateUser,
}));
vi.mock("../../hooks/api/users/use-delete-user.mutation", () => ({
  useDeleteUserMutation: () => ({ mutateAsync: vi.fn() }),
}));

const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useLocation: () => ({ state: undefined, search: "" }),
  };
});

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

describe("<UserDetailRoute />", () => {
  beforeEach(() => {
    cleanup();
    updateUser.mutateAsync.mockReset();
    render(
      <MemoryRouter initialEntries={["/users/1"]}>
        <Routes>
          <Route path="/users/:id_user" element={<UserDetailRoute />} />
        </Routes>
      </MemoryRouter>
    );
  });

  it("debería mostrar los datos del usuario", async () => {
    expect((await screen.findByTestId("user-id")).getAttribute("value")).toBe("1");
    expect((await screen.findByTestId("user-name")).getAttribute("value")).toBe("Usuario Demo");
    expect((await screen.findByTestId("user-first-surname")).getAttribute("value")).toBe("Apellido1");
    expect((await screen.findByTestId("user-email")).getAttribute("value")).toBe("demo@user.com");
    expect((await screen.findByTestId("user-phone")).getAttribute("value")).toBe("600111222");
  });

  it("debería permitir editar y guardar el usuario", async () => {
    const nombre = await screen.findByTestId("user-name");
    await userEvent.clear(nombre);
    await userEvent.type(nombre, "Usuario Editado");
    const guardar = await screen.findByTestId("save-user");
    await userEvent.click(guardar);
    await waitFor(() => {
      expect(updateUser.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Usuario Editado" })
      );
    });
  });
});
