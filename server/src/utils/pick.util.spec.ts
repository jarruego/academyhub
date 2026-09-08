import { pick } from "./pick.util";

describe("pick.util · pick", () => {
  it("conserva solo las claves indicadas", () => {
    expect(pick({ a: 1, b: 2, c: 3 }, ["a", "c"])).toEqual({ a: 1, c: 3 });
  });

  it("ignora claves de la whitelist ausentes en el objeto", () => {
    const obj: { a: number; b?: number } = { a: 1 };
    expect(pick(obj, ["a", "b"])).toEqual({ a: 1 });
  });

  it("devuelve un objeto vacío si no se piden claves", () => {
    expect(pick({ a: 1 }, [])).toEqual({});
  });
});
