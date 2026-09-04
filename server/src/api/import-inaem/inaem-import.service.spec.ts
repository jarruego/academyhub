import { Test, TestingModule } from "@nestjs/testing";
import { DATABASE_PROVIDER } from "src/database/database.module";
import { DatabaseService } from "src/database/database.service";
import { JobService } from "../import-sage/job.service";
import { GroupService } from "../group/group.service";
import { UserPreinscriptionRepository } from "src/database/repository/preinscription/user-preinscription.repository";
import { UserGroupRepository } from "src/database/repository/group/user-group.repository";
import { CatalogCourseRepository } from "src/database/repository/course/catalog-course.repository";
import { CourseCandidateRepository } from "src/database/repository/course-candidate/course-candidate.repository";
import { CourseInterestRepository } from "src/database/repository/course-interest/course-interest.repository";
import { InterestStatus } from "src/types/course-interest/course-interest.enums";
import { InaemImportService } from "./inaem-import.service";

describe("InaemImportService.linkOpenInterest", () => {
  let service: InaemImportService;
  let interestRepo: { findById: jest.Mock; findOpenByUserAndCatalogCourse: jest.Mock; update: jest.Mock };
  let courseCandidateRepo: { update: jest.Mock };

  const candidate = (overrides: Partial<{ id_candidate: number; id_user: number; id_interest: number | null }> = {}) => ({
    id_candidate: 1,
    id_user: 10,
    id_interest: null,
    ...overrides,
  });

  const course = { id_course: 5, id_catalog_course: 50 };

  beforeEach(async () => {
    interestRepo = {
      findById: jest.fn(),
      findOpenByUserAndCatalogCourse: jest.fn(),
      update: jest.fn(),
    };
    courseCandidateRepo = { update: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InaemImportService,
        { provide: DATABASE_PROVIDER, useValue: {} },
        { provide: DatabaseService, useValue: {} },
        { provide: JobService, useValue: {} },
        { provide: GroupService, useValue: {} },
        { provide: UserPreinscriptionRepository, useValue: {} },
        { provide: UserGroupRepository, useValue: {} },
        { provide: CatalogCourseRepository, useValue: {} },
        { provide: CourseCandidateRepository, useValue: courseCandidateRepo },
        { provide: CourseInterestRepository, useValue: interestRepo },
      ],
    }).compile();

    service = module.get(InaemImportService);
  });

  const linkOpenInterest = (c: ReturnType<typeof candidate>, target: InterestStatus) =>
    (service as any).linkOpenInterest(c, course, target);

  it("no hace nada si la candidatura no tiene interés vinculado y no hay ninguno abierto", async () => {
    interestRepo.findOpenByUserAndCatalogCourse.mockResolvedValue(undefined);

    await linkOpenInterest(candidate(), InterestStatus.CALLED);

    expect(interestRepo.findOpenByUserAndCatalogCourse).toHaveBeenCalledWith(10, 50);
    expect(courseCandidateRepo.update).not.toHaveBeenCalled();
    expect(interestRepo.update).not.toHaveBeenCalled();
  });

  it("vincula un interés abierto no asociado todavía y avanza su estado", async () => {
    interestRepo.findOpenByUserAndCatalogCourse.mockResolvedValue({ id_interest: 99 });
    interestRepo.findById.mockResolvedValue({ id_interest: 99, status: "INTERESADO" });

    await linkOpenInterest(candidate(), InterestStatus.CALLED);

    expect(courseCandidateRepo.update).toHaveBeenCalledWith(1, { id_interest: 99 });
    expect(interestRepo.update).toHaveBeenCalledWith(99, { status: InterestStatus.CALLED });
  });

  it("si ya está vinculado, no vuelve a buscar uno abierto", async () => {
    interestRepo.findById.mockResolvedValue({ id_interest: 7, status: "CONTACTADO" });

    await linkOpenInterest(candidate({ id_interest: 7 }), InterestStatus.CALLED);

    expect(interestRepo.findOpenByUserAndCatalogCourse).not.toHaveBeenCalled();
    expect(courseCandidateRepo.update).not.toHaveBeenCalled();
    expect(interestRepo.update).toHaveBeenCalledWith(7, { status: InterestStatus.CALLED });
  });

  it("nunca retrocede un estado ya más avanzado (reimportación de Preinscripciones tras Alumnos)", async () => {
    interestRepo.findById.mockResolvedValue({ id_interest: 7, status: "MATRICULADO" });

    await linkOpenInterest(candidate({ id_interest: 7 }), InterestStatus.CALLED);

    expect(interestRepo.update).not.toHaveBeenCalled();
  });

  it("no revierte un interés DESCARTADO", async () => {
    interestRepo.findById.mockResolvedValue({ id_interest: 7, status: "DESCARTADO" });

    await linkOpenInterest(candidate({ id_interest: 7 }), InterestStatus.ENROLLED);

    expect(interestRepo.update).not.toHaveBeenCalled();
  });
});
