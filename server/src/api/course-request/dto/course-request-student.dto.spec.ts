import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CourseRequestStudentDto } from "./course-request-student.dto";

describe("CourseRequestStudentDto (saneo al guardar)", () => {
  it("asea espacios, DNI y email antes de validar (igual que otras importaciones)", async () => {
    const instance = plainToInstance(CourseRequestStudentDto, {
      name: "  Juan   ",
      first_surname: " García ",
      second_surname: "",
      dni: " 12345678-a ",
      email: " Juan.Garcia@Example.COM ",
      phone_mobile: "600 111 222",
    });

    expect(instance.name).toBe("Juan");
    expect(instance.first_surname).toBe("García");
    expect(instance.dni).toBe("12345678A");
    expect(instance.email).toBe("juan.garcia@example.com");
    expect(instance.phone_mobile).toBe("600111222");

    const errors = await validate(instance);
    expect(errors).toHaveLength(0);
  });

  it("no bloquea el guardado con datos incompletos o inválidos (el aviso es solo visual en el cliente)", async () => {
    const instance = plainToInstance(CourseRequestStudentDto, {
      name: "",
      first_surname: "García",
      dni: "no-es-un-dni",
      email: "no-es-un-email",
    });
    const errors = await validate(instance);
    expect(errors).toHaveLength(0);
  });

  it("permite una fila completamente vacía", async () => {
    const instance = plainToInstance(CourseRequestStudentDto, {});
    const errors = await validate(instance);
    expect(errors).toHaveLength(0);
  });
});
