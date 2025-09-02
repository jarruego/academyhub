import { beforeEach, describe, expect, it, vi } from "vitest";
import EditGroupRoute from "./group-detail.route";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import userEvent from "@testing-library/user-event";

const updateGroup = { mutateAsync: vi.fn() };
const deleteGroup = { mutateAsync: vi.fn() };
const groupData = {
  id_group: 1,
  group_name: "Grupo Demo",
  id_course: 2,
  description: "desc",
  start_date: null,
  end_date: null,
  fundae_id: "F123"
};

vi.mock("../../hooks/api/groups/use-group.query", () => ({
  useGroupQuery: () => ({ data: groupData, isLoading: false }),
}));
vi.mock("../../hooks/api/groups/use-update-group.mutation", () => ({
  useUpdateGroupMutation: () => updateGroup,
}));
vi.mock("../../hooks/api/groups/use-delete-group.mutation", () => ({
  useDeleteGroupMutation: () => deleteGroup,
}));
vi.mock("../../hooks/api/users/use-users-by-group.query", () => ({
  useUsersByGroupQuery: () => ({ data: [], isLoading: false }),
}));

describe("<EditGroupRoute />", () => {
  beforeEach(() => {
    cleanup();
    updateGroup.mutateAsync.mockReset();
    render(
      <MemoryRouter initialEntries={["/groups/1"]}>
        <Routes>
          <Route path="/groups/:id_group" element={<EditGroupRoute />} />
        </Routes>
      </MemoryRouter>
    );
  });

  it("debería mostrar los datos del grupo", async () => {
    expect((await screen.findByTestId("group-name")).getAttribute("value")).toBe("Grupo Demo");
    expect((await screen.findByTestId("group-description")).getAttribute("value")).toBe("desc");
  });

  it("debería permitir editar y guardar el grupo", async () => {
    const nombre = await screen.findByTestId("group-name");
    await userEvent.clear(nombre);
    await userEvent.type(nombre, "Grupo Editado");
    const guardar = await screen.findByTestId("save-group");
    await userEvent.click(guardar);
    await waitFor(() => {
      expect(updateGroup.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ group_name: "Grupo Editado" })
      );
    });
  });
});
