import { sanitizePhone, phoneDigits } from "./phone.util";

describe("phone.util", () => {
  describe("phoneDigits", () => {
    it("extrae solo dígitos", () => {
      expect(phoneDigits("600 11.22-33")).toBe("60011 2233".replace(" ", ""));
      expect(phoneDigits("+34 600112233")).toBe("34600112233");
    });
    it("vacíos -> ''", () => {
      expect(phoneDigits(null)).toBe("");
      expect(phoneDigits(undefined)).toBe("");
      expect(phoneDigits("")).toBe("");
    });
  });

  describe("sanitizePhone", () => {
    it("quita espacios, puntos y guiones", () => {
      expect(sanitizePhone(" 600 11.22-33 ")).toBe("600112233");
      expect(sanitizePhone("600.112.233")).toBe("600112233");
      expect(sanitizePhone("600-11-22-33")).toBe("60011 2233".replace(" ", ""));
    });
    it("conserva el prefijo internacional +", () => {
      expect(sanitizePhone("+34 600 112 233")).toBe("+34600112233");
    });
    it("descarta si quedan menos de 9 dígitos", () => {
      expect(sanitizePhone("600 11 22")).toBeUndefined(); // 7 dígitos
      expect(sanitizePhone("1234")).toBeUndefined();
    });
    it("acepta exactamente 9 dígitos", () => {
      expect(sanitizePhone("600112233")).toBe("600112233");
    });
    it("vacíos/null/undefined -> undefined", () => {
      expect(sanitizePhone(null)).toBeUndefined();
      expect(sanitizePhone(undefined)).toBeUndefined();
      expect(sanitizePhone("   ")).toBeUndefined();
    });
  });
});
