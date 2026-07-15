import { GroupService } from './group.service';

// Construye el servicio con repos mockeados y una transacción que ejecuta el callback.
function buildService({ otherGroups = [] as number[] }) {
  const databaseService = { db: { transaction: (cb: any) => cb({}) } } as any;
  const groupRepository = { findById: jest.fn().mockResolvedValue({ id_group: 1, id_course: 10 }) } as any;
  const userCourseRepository = { deleteUserFromCourse: jest.fn().mockResolvedValue({}) } as any;
  const userGroupRepository = {
    isUserEnrolledInOtherGroups: jest.fn().mockResolvedValue(otherGroups.length > 0),
    deleteUserFromGroup: jest.fn().mockResolvedValue({}),
  } as any;

  const service = new GroupService(
    groupRepository,
    {} as any,
    userCourseRepository,
    userGroupRepository,
    {} as any,
    {} as any,
    databaseService,
  );
  return { service, userCourseRepository, userGroupRepository };
}

describe('GroupService.deleteUserFromGroup — limpieza de la matrícula del curso', () => {
  it('borra la matrícula del curso si el usuario no está en otro grupo del curso', async () => {
    const { service, userCourseRepository, userGroupRepository } = buildService({ otherGroups: [] });
    await service.deleteUserFromGroup(1, 100);
    expect(userCourseRepository.deleteUserFromCourse).toHaveBeenCalledWith(10, 100, expect.anything());
    expect(userGroupRepository.deleteUserFromGroup).toHaveBeenCalledWith(1, 100, expect.anything());
  });

  it('conserva la matrícula si el usuario sigue en otro grupo del mismo curso', async () => {
    const { service, userCourseRepository, userGroupRepository } = buildService({ otherGroups: [2] });
    await service.deleteUserFromGroup(1, 100);
    expect(userCourseRepository.deleteUserFromCourse).not.toHaveBeenCalled();
    expect(userGroupRepository.deleteUserFromGroup).toHaveBeenCalledWith(1, 100, expect.anything());
  });
});
