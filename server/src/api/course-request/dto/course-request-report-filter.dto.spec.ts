// El DTO usa @Type() (class-transformer) en id_center/id_course, que necesita el
// polyfill de metadatos cargado antes de que se evalúen sus decoradores; en la
// app real lo carga el bootstrap de Nest (main.ts), aquí hay que importarlo a mano.
import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CourseRequestReportFilterDto } from "./course-request-report-filter.dto";

describe("CourseRequestReportFilterDto (id_company multi-selección)", () => {
  it("acepta varios valores (repetición del query param, como los parsea qs)", async () => {
    const instance = plainToInstance(CourseRequestReportFilterDto, { id_company: ["3", "5"] });
    expect(instance.id_company).toEqual([3, 5]);
    expect(await validate(instance)).toHaveLength(0);
  });

  it("acepta un único valor suelto (string) y lo convierte en array de un elemento", async () => {
    const instance = plainToInstance(CourseRequestReportFilterDto, { id_company: "3" });
    expect(instance.id_company).toEqual([3]);
    expect(await validate(instance)).toHaveLength(0);
  });

  it("ausente -> undefined (no filtra por empresa)", async () => {
    const instance = plainToInstance(CourseRequestReportFilterDto, {});
    expect(instance.id_company).toBeUndefined();
    expect(await validate(instance)).toHaveLength(0);
  });

  it("descarta valores no enteros/no positivos", async () => {
    const instance = plainToInstance(CourseRequestReportFilterDto, { id_company: ["3", "abc", "-1", "0"] });
    expect(instance.id_company).toEqual([3]);
  });
});
