import { beforeEach, describe, expect, it, vi } from "vitest";
import CreateCourseRoute from "./create-course.route";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";

const create = {
    mutate: vi.fn(),
};

vi.spyOn(create, "mutate");

vi.mock("../../hooks/api/courses/use-create-course.mutation", () => ({
    useCreateCourseMutation: () => ({
        mutateAsync: create.mutate,
    }),
}));

describe("<CreateCourseRoute/>", () => {
    beforeEach(() => {
        cleanup();
        render(
            <MemoryRouter>
                <CreateCourseRoute />
            </MemoryRouter>
        );
        create.mutate.mockReset();
    });

    describe("when submitting valid data", () => {
        it("should call the mutation to create the course", async () => {
            const courseName = await screen.findByTestId("course-name");
            const shortName = await screen.findByTestId("short-name");
            const modalityLabel = await screen.findByLabelText(/modalidad/i);
            await userEvent.type(courseName, "Curso Test");
            await userEvent.type(shortName, "CT");
            // Modalidad: simular el evento de cambio con el valor real del enum
            // Buscar el input oculto del Select y disparar el evento change
            const selectInput = modalityLabel.closest('div')?.querySelector('input');
            if (selectInput) {
                selectInput.focus();
                await userEvent.click(selectInput);
            }
            // Seleccionar la opción con el valor real del enum (ajusta si es diferente)
            const onlineOption = await screen.findByTitle('Online');
            await userEvent.click(onlineOption);
            // No rellenar fechas (opcional)
            const submit = await screen.findByRole("button", { name: /guardar/i });
            await userEvent.click(submit);
            expect(create.mutate).toHaveBeenCalled();
        });
    });

    describe("when submitting invalid data", () => {
        it("should not submit if required fields are empty", async () => {
            const submit = await screen.findByRole("button", { name: /guardar/i });
            await userEvent.click(submit);
            expect(create.mutate).not.toHaveBeenCalled();
        });
    });
});
