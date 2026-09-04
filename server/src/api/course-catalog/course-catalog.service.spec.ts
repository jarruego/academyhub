import { ConflictException, NotFoundException } from "@nestjs/common";
import { CourseCatalogService } from "./course-catalog.service";

describe("CourseCatalogService", () => {
  const build = () => {
    const repository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findEditions: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
      transaction: jest.fn(),
    } as any;
    return { repository, service: new CourseCatalogService(repository) };
  };

  it("devuelve la ficha con sus ediciones", async () => {
    const { repository, service } = build();
    repository.findById.mockResolvedValue({ id_catalog_course: 2, name: "Manipulador" });
    repository.findEditions.mockResolvedValue([{ id_course: 7 }]);
    await expect(service.findById(2)).resolves.toMatchObject({ editions: [{ id_course: 7 }] });
  });

  it("rechaza una ficha inexistente", async () => {
    const { service } = build();
    await expect(service.findById(99)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("convierte cadenas vacías opcionales a null al crear", async () => {
    const { repository, service } = build();
    repository.create.mockImplementation((data: unknown) => data);
    await service.create({ name: " Manipulador ", internal_code: "" });
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ name: "Manipulador", internal_code: null }));
  });

  it("traduce colisiones de nombre/código a un conflicto de dominio", async () => {
    const { repository, service } = build();
    repository.create.mockRejectedValue({ code: "23505" });
    await expect(service.create({ name: "Duplicado" })).rejects.toBeInstanceOf(ConflictException);
  });
});
