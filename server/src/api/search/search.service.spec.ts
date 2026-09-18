import { SearchService } from "./search.service";

describe("SearchService", () => {
  const repository = {
    searchUsers: jest.fn(),
    searchCourses: jest.fn(),
    searchCompanies: jest.fn(),
    searchCenters: jest.fn(),
  } as any;
  const service = new SearchService(repository);

  beforeEach(() => jest.clearAllMocks());

  it("no consulta la BD con un término demasiado corto (0-1 caracteres)", async () => {
    const result = await service.search("a");
    expect(result).toEqual({ users: [], courses: [], companies: [], centers: [] });
    expect(repository.searchUsers).not.toHaveBeenCalled();
  });

  it("no consulta la BD con un término vacío o solo espacios", async () => {
    await service.search("  ");
    expect(repository.searchUsers).not.toHaveBeenCalled();
  });

  it("agrega los resultados de las 4 categorías para un término válido", async () => {
    repository.searchUsers.mockResolvedValue([{ id_user: 1, name: "Ana" }]);
    repository.searchCourses.mockResolvedValue([{ id_course: 2, catalog_course_name: "Manipulador" }]);
    repository.searchCompanies.mockResolvedValue([{ id_company: 3, company_name: "ACME" }]);
    repository.searchCenters.mockResolvedValue([{ id_center: 4, center_name: "Centro A" }]);

    const result = await service.search("ana");

    expect(repository.searchUsers).toHaveBeenCalledWith("ana", 5);
    expect(repository.searchCourses).toHaveBeenCalledWith("ana", 5);
    expect(repository.searchCompanies).toHaveBeenCalledWith("ana", 5);
    expect(repository.searchCenters).toHaveBeenCalledWith("ana", 5);
    expect(result).toEqual({
      users: [{ id_user: 1, name: "Ana" }],
      courses: [{ id_course: 2, catalog_course_name: "Manipulador" }],
      companies: [{ id_company: 3, company_name: "ACME" }],
      centers: [{ id_center: 4, center_name: "Centro A" }],
    });
  });

  it("recorta espacios del término antes de buscar", async () => {
    repository.searchUsers.mockResolvedValue([]);
    repository.searchCourses.mockResolvedValue([]);
    repository.searchCompanies.mockResolvedValue([]);
    repository.searchCenters.mockResolvedValue([]);

    await service.search("  ana  ");

    expect(repository.searchUsers).toHaveBeenCalledWith("ana", 5);
  });
});
