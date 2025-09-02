import { beforeEach, describe, expect, it, vi } from "vitest";
import CreateGroupRoute from "./create-group.route";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import userEvent from "@testing-library/user-event";

const createGroup = { mutateAsync: vi.fn() };
const courseData = { course_name: "Curso Demo" };

vi.mock("../../hooks/api/groups/use-create-group.mutation", () => ({
  useCreateGroupMutation: () => createGroup,
}));
vi.mock("../../hooks/api/courses/use-course.query", () => ({
  useCourseQuery: () => ({ data: courseData }),
}));

describe("<CreateGroupRoute />", () => {
  beforeEach(() => {
    cleanup();
    createGroup.mutateAsync.mockReset();
    render(
      <MemoryRouter initialEntries={["/courses/1/groups/create"]}>
        <Routes>
          <Route path="/courses/:id_course/groups/create" element={<CreateGroupRoute />} />
        </Routes>
      </MemoryRouter>
    );
  });

  it("debería crear un grupo con datos válidos", async () => {
    const nombre = await screen.findByTestId("group-name");
    await userEvent.type(nombre, "Grupo Test");
    const submit = await screen.findByRole("button", { name: /crear grupo/i });
    await userEvent.click(submit);
    expect(createGroup.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ group_name: "Grupo Test" })
    );
  });

  it("no debería enviar si el nombre está vacío", async () => {
    const submit = await screen.findByRole("button", { name: /crear grupo/i });
    await userEvent.click(submit);
    expect(createGroup.mutateAsync).not.toHaveBeenCalled();
  });
});
