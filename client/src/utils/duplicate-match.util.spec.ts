import { describe, it, expect } from "vitest";
import { findPotentialDuplicate } from "./duplicate-match.util";
import type { PersonLookup } from "../components/common/PersonSearchOrCreateModal";

const pool: PersonLookup[] = [
  { id_user: 1, name: "Juan", first_surname: "García", second_surname: "López", dni: "12345678Z", phone: "600111222", email: "juan@example.com" },
  { id_user: 2, name: "María", first_surname: "Pérez", second_surname: null, dni: null, phone: null, email: "maria@example.com" },
];

describe("findPotentialDuplicate", () => {
  it("detecta coincidencia exacta por DNI (normalizado)", () => {
    const match = findPotentialDuplicate({ name: "Otro Nombre", dni: "12345678-z" }, pool);
    expect(match).toEqual({ person: pool[0], confidence: "exact", matchedOn: "dni" });
  });

  it("detecta coincidencia exacta por email (case-insensitive)", () => {
    const match = findPotentialDuplicate({ name: "Otro Nombre", email: "MARIA@example.com" }, pool);
    expect(match).toEqual({ person: pool[1], confidence: "exact", matchedOn: "email" });
  });

  it("detecta coincidencia exacta por teléfono (ignora prefijos)", () => {
    const match = findPotentialDuplicate({ name: "Otro Nombre", phone: "+34600111222" }, pool);
    expect(match).toEqual({ person: pool[0], confidence: "exact", matchedOn: "phone" });
  });

  it("detecta nombre muy similar (posible error de tecleo) sin otros datos", () => {
    const match = findPotentialDuplicate({ name: "Juan", first_surname: "Garcia", second_surname: "Lopez" }, pool);
    expect(match?.person.id_user).toBe(1);
    expect(match?.confidence).toBe("similar");
  });

  it("no encuentra nada cuando la persona es claramente distinta", () => {
    const match = findPotentialDuplicate({ name: "Carlos", first_surname: "Ruiz", phone: "699888777" }, pool);
    expect(match).toBeNull();
  });
});
