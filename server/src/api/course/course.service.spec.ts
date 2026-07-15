import { ConflictException } from '@nestjs/common';
import { CourseService } from './course.service';

// Construye el servicio con repos mockeados y una transacción que ejecuta el callback.
// Sólo se mockean las dependencias que toca el borrado; el resto van vacías.
function buildService({ groups = 0, enrollments = 0, preinscriptions = 0 }) {
  const databaseService = { db: { transaction: (cb: any) => cb({}) } } as any;
  const courseRepository = { deleteById: jest.fn().mockResolvedValue({}) } as any;
  const userCourseRepository = {
    countByCourse: jest.fn().mockResolvedValue(enrollments),
    deleteByCourse: jest.fn().mockResolvedValue([]),
  } as any;
  const userPreinscriptionRepository = {
    countByCourse: jest.fn().mockResolvedValue(preinscriptions),
  } as any;
  const groupRepository = { countByCourse: jest.fn().mockResolvedValue(groups) } as any;

  const service = new CourseService(
    courseRepository,
    userCourseRepository,
    userPreinscriptionRepository,
    groupRepository,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    databaseService,
  );
  return { service, courseRepository, userCourseRepository };
}

describe('CourseService.deleteById — dependencias que retienen el curso', () => {
  it('borra el curso cuando no hay nada asociado', async () => {
    const { service, courseRepository } = buildService({});
    await service.deleteById(10);
    expect(courseRepository.deleteById).toHaveBeenCalledWith(10, expect.anything());
  });

  it('bloquea si hay preinscripciones, aunque se confirme el borrado de matrículas', async () => {
    const { service, courseRepository, userCourseRepository } = buildService({ preinscriptions: 3, enrollments: 2 });
    await expect(service.deleteById(10, true)).rejects.toBeInstanceOf(ConflictException);
    // Las preinscripciones nunca se arrastran: no debe tocar matrículas ni el curso.
    expect(userCourseRepository.deleteByCourse).not.toHaveBeenCalled();
    expect(courseRepository.deleteById).not.toHaveBeenCalled();
  });

  it('bloquea si hay grupos', async () => {
    const { service, courseRepository } = buildService({ groups: 1 });
    await expect(service.deleteById(10, true)).rejects.toMatchObject({
      message: expect.stringContaining('grupo'),
    });
    expect(courseRepository.deleteById).not.toHaveBeenCalled();
  });

  it('bloquea si hay matrículas y no se confirma el borrado', async () => {
    const { service, courseRepository, userCourseRepository } = buildService({ enrollments: 4 });
    await expect(service.deleteById(10)).rejects.toMatchObject({
      message: expect.stringContaining('4 matrícula(s)'),
    });
    expect(userCourseRepository.deleteByCourse).not.toHaveBeenCalled();
    expect(courseRepository.deleteById).not.toHaveBeenCalled();
  });

  it('borra matrículas y curso cuando se confirma', async () => {
    const { service, courseRepository, userCourseRepository } = buildService({ enrollments: 4 });
    await service.deleteById(10, true);
    expect(userCourseRepository.deleteByCourse).toHaveBeenCalledWith(10, expect.anything());
    expect(courseRepository.deleteById).toHaveBeenCalledWith(10, expect.anything());
  });
});

describe('CourseService.getDeletionCheck', () => {
  it('marca canDelete cuando el curso está limpio', async () => {
    const { service } = buildService({});
    await expect(service.getDeletionCheck(10)).resolves.toMatchObject({
      canDelete: true,
      requiresEnrollmentDeletion: false,
    });
  });

  it('pide confirmación de matrículas cuando sólo hay matrículas', async () => {
    const { service } = buildService({ enrollments: 2 });
    await expect(service.getDeletionCheck(10)).resolves.toMatchObject({
      enrollments: 2,
      canDelete: false,
      requiresEnrollmentDeletion: true,
    });
  });

  it('no ofrece cascada de matrículas si además hay preinscripciones', async () => {
    const { service } = buildService({ enrollments: 2, preinscriptions: 5 });
    await expect(service.getDeletionCheck(10)).resolves.toMatchObject({
      canDelete: false,
      requiresEnrollmentDeletion: false,
    });
  });
});
