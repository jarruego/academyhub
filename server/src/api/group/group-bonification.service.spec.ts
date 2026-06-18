import { BadRequestException } from '@nestjs/common';
import { GroupBonificableService } from './group-bonification.service';
import { CourseFunding } from 'src/types/course/course-funding.enum';

// Construye el servicio con repos mockeados y una transacción que ejecuta el callback.
function buildService(course: any, group: any = { id_group: 1, id_course: 10, fundae_id: '123', group_name: 'G1' }) {
  const databaseService = { db: { transaction: (cb: any) => cb({}) } } as any;
  const groupRepository = { findById: jest.fn().mockResolvedValue(group) } as any;
  const userGroupRepository = { findUsersInGroupByIds: jest.fn().mockResolvedValue([]) } as any;
  const courseRepository = { findById: jest.fn().mockResolvedValue(course) } as any;
  return new GroupBonificableService(databaseService, groupRepository, userGroupRepository, courseRepository);
}

describe('GroupBonificableService — guarda de financiación FUNDAE', () => {
  it('rechaza un curso clasificado como PRIVADA', async () => {
    const service = buildService({ id_course: 10, funding: CourseFunding.PRIVADA, fundae_id: '123', price_per_hour: 10, hours: 20 });
    await expect(service.generateBonificationFile(1, [1])).rejects.toMatchObject({
      message: expect.stringContaining('no es bonificable FUNDAE'),
    });
  });

  it('rechaza un curso clasificado como PUBLICA (INAEM)', async () => {
    const service = buildService({ id_course: 10, funding: CourseFunding.PUBLICA, fundae_id: '123' });
    await expect(service.generateBonificationFile(1, [1])).rejects.toBeInstanceOf(BadRequestException);
  });

  it('no aplica la guarda cuando funding es null: cae en la validación de fundae_id', async () => {
    // funding sin clasificar + fundae_id ausente -> debe fallar por fundae_id, NO por funding.
    const service = buildService({ id_course: 10, funding: null, fundae_id: null });
    await expect(service.generateBonificationFile(1, [1])).rejects.toMatchObject({
      message: expect.stringContaining('FUNDAE ID is missing'),
    });
  });
});
