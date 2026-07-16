import { describe, expect, it } from "vitest";
import { readStoredPreferences } from "./ui-preferences";

describe("readStoredPreferences", () => {
  it("cae a los defaults cuando no hay nada guardado", () => {
    expect(readStoredPreferences(null)).toEqual({ mode: "light", density: "comfortable" });
  });

  it("lee las preferencias guardadas", () => {
    expect(readStoredPreferences('{"mode":"dark","density":"compact"}')).toEqual({
      mode: "dark",
      density: "compact",
    });
  });

  it("no revienta con JSON corrupto", () => {
    expect(readStoredPreferences("{no es json")).toEqual({ mode: "light", density: "comfortable" });
  });

  it("descarta valores desconocidos en lugar de propagarlos al tema", () => {
    expect(readStoredPreferences('{"mode":"solarized","density":42}')).toEqual({
      mode: "light",
      density: "comfortable",
    });
  });

  it("completa los campos que falten", () => {
    expect(readStoredPreferences('{"mode":"dark"}')).toEqual({ mode: "dark", density: "comfortable" });
  });
});
