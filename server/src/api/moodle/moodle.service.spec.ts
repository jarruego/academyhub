import { MoodleService } from './moodle.service';

// MoodleService tiene muchas dependencias; para probar SOLO el parsing de las
// respuestas del plugin block_advanced_reports pasamos dummies y espiamos el
// método privado `request` (que en producción hace la llamada HTTP).
const makeService = (overrides: Partial<Record<string, unknown>> = {}) =>
  new MoodleService(
    { db: {} } as any,                          // databaseService
    {} as any,                                  // courseRepository
    {} as any,                                  // groupRepository
    {} as any,                                  // organizationRepository
    {} as any,                                  // userCourseRepository
    (overrides.userRepository ?? {}) as any,    // userRepository
    {} as any,                                  // userGroupRepository
    (overrides.moodleUserService ?? {}) as any, // moodleUserService
    {} as any,                                  // groupService
  );

describe('MoodleService — parsing de block_advanced_reports', () => {
  describe('getAdvancedReportsUserStats (tiempo en bloque)', () => {
    it('llama a get_userstats con el stat y parsea la forma { values: [...] }', async () => {
      const svc = makeService();
      const reqSpy = jest.spyOn(svc as any, 'request').mockResolvedValue({
        values: [
          { userid: 1, value: '3600' },
          { userid: 2, value: '06h 14m 24s' },
        ],
      });

      const map = await (svc as any).getAdvancedReportsUserStats(1, 'platformdedicationtime');

      expect(reqSpy).toHaveBeenCalledWith(
        'block_advanced_reports_get_userstats',
        { params: { courseid: 1, stat: 'platformdedicationtime' }, method: 'post' },
      );
      // segundos numéricos y cadenas "06h 14m 24s"
      expect(map.get(1)).toBe(3600);
      expect(map.get(2)).toBe(6 * 3600 + 14 * 60 + 24);
    });

    it('ignora filas con userid o value no parseables', async () => {
      const svc = makeService();
      jest.spyOn(svc as any, 'request').mockResolvedValue({
        values: [
          { userid: 'x', value: '10' },
          { userid: 7, value: '40' },
        ],
      });

      const map = await (svc as any).getAdvancedReportsUserStats(1, 'platformdedicationtime');
      expect(map.size).toBe(1);
      expect(map.get(7)).toBe(40);
    });
  });
});

// La app crea los usuarios en Moodle usando el DNI normalizado como username
// (ver `createLocalUsersInMoodle`), así que el username es una vía de
// emparejamiento fiable de vuelta. `18457959E` y `Y8109788W` son documentos con
// letra de control correcta; `12345678A` no lo es.
describe('MoodleService — emparejamiento de usuarios de Moodle con usuarios locales', () => {
  describe('moodleUserDniVariants', () => {
    it('incluye el customfield dni y el username en crudo y normalizado', () => {
      const svc = makeService();
      const variants = (svc as any).moodleUserDniVariants({
        id: 1,
        username: '18457959e',
        customfields: [{ shortname: 'dni', value: '18457959-E' }],
      });

      expect(variants).toEqual(expect.arrayContaining(['18457959-E', '18457959E', '18457959e']));
    });

    it('ignora el username cuando no es un documento válido', () => {
      const svc = makeService();
      const variants = (svc as any).moodleUserDniVariants({ id: 1, username: 'jarruego' });

      expect(variants).toEqual([]);
    });

    it('ignora un username con letra de control incorrecta', () => {
      const svc = makeService();
      const variants = (svc as any).moodleUserDniVariants({ id: 1, username: '12345678a' });

      expect(variants).toEqual([]);
    });

    it('acepta NIE como username', () => {
      const svc = makeService();
      const variants = (svc as any).moodleUserDniVariants({ id: 1, username: 'y8109788w' });

      expect(variants).toContain('Y8109788W');
    });
  });

  describe('linkOrCreateLocalUserForMoodleUser', () => {
    const tx = {} as any;

    it('empareja por username-DNI en vez de duplicar el usuario', async () => {
      const userRepository = {
        findByDniAny: jest.fn().mockResolvedValue({ id_user: 42 }),
        create: jest.fn(),
      };
      const moodleUserService = {
        findByMoodleId: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ insertId: 7 }),
      };
      const svc = makeService({ userRepository, moodleUserService });

      const result = await (svc as any).linkOrCreateLocalUserForMoodleUser(
        { id: 20312, username: '18457959e', firstname: 'Ana', lastname: 'Pérez', email: 'a@b.com' },
        tx,
      );

      expect(result).toEqual({ userId: 42, moodleUserId: 7, matchedBy: 'dni' });
      expect(userRepository.create).not.toHaveBeenCalled();
      expect(moodleUserService.create).toHaveBeenCalledWith(
        { id_user: 42, moodle_id: 20312, moodle_username: '18457959e' },
        { transaction: tx },
      );
    });

    it('guarda el DNI normalizado al crear un usuario nuevo cuyo username es válido', async () => {
      const userRepository = {
        findByDniAny: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ insertId: 99 }),
      };
      const moodleUserService = {
        findByMoodleId: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ insertId: 8 }),
      };
      const svc = makeService({ userRepository, moodleUserService });

      const result = await (svc as any).linkOrCreateLocalUserForMoodleUser(
        { id: 20313, username: '18457959e', firstname: 'Ana', lastname: 'Pérez', email: 'a@b.com' },
        tx,
      );

      expect(result.matchedBy).toBe('created');
      expect(userRepository.create).toHaveBeenCalledWith(
        { name: 'Ana', first_surname: 'Pérez', email: 'a@b.com', dni: '18457959E' },
        { transaction: tx },
      );
    });

    it('no inventa DNI cuando el username no es un documento', async () => {
      const userRepository = {
        findByDniAny: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ insertId: 99 }),
      };
      const moodleUserService = {
        findByMoodleId: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ insertId: 8 }),
      };
      const svc = makeService({ userRepository, moodleUserService });

      await (svc as any).linkOrCreateLocalUserForMoodleUser(
        { id: 20314, username: 'jarruego', firstname: 'Jose', lastname: 'Arruego', email: 'j@b.com' },
        tx,
      );

      expect(userRepository.findByDniAny).not.toHaveBeenCalled();
      expect(userRepository.create).toHaveBeenCalledWith(
        { name: 'Jose', first_surname: 'Arruego', email: 'j@b.com' },
        { transaction: tx },
      );
    });

    it('reutiliza el vínculo existente por moodle_id y refresca el username', async () => {
      const userRepository = { findByDniAny: jest.fn(), create: jest.fn() };
      const moodleUserService = {
        findByMoodleId: jest.fn().mockResolvedValue({ id_user: 5, id_moodle_user: 3 }),
        update: jest.fn().mockResolvedValue(undefined),
        create: jest.fn(),
      };
      const svc = makeService({ userRepository, moodleUserService });

      const result = await (svc as any).linkOrCreateLocalUserForMoodleUser(
        { id: 20315, username: 'nuevo_username', firstname: 'Ana', lastname: 'Pérez', email: 'a@b.com' },
        tx,
      );

      expect(result).toEqual({ userId: 5, moodleUserId: 3, matchedBy: 'moodle_id' });
      expect(moodleUserService.update).toHaveBeenCalledWith(3, { moodle_username: 'nuevo_username' }, { transaction: tx });
      expect(userRepository.findByDniAny).not.toHaveBeenCalled();
      expect(userRepository.create).not.toHaveBeenCalled();
    });
  });
});
