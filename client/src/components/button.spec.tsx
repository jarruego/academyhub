import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Button from "./button";

// test = it

vi.spyOn(console, "log");

describe('<Button/>', () => {
    afterEach(() => {
        cleanup();
    });
    
    it("should render", async () => {
        render(<Button>Hola</Button>);

        const button = await screen.findByText("Hola");
        expect(button).toBeDefined();
    });

    it("should click", async () => {
        render(<Button onClick={() => console.log("Adios")}>Hola</Button>);
        const button = await screen.findByText("Hola");

        fireEvent.click(button);
        expect(console.log).toHaveBeenCalled();
        expect(console.log).toHaveBeenCalledWith("Adios");
    });
});
