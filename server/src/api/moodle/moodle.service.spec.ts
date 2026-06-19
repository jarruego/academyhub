import { MoodleService } from './moodle.service';

// MoodleService tiene muchas dependencias; para probar SOLO el parsing de las
// respuestas del plugin block_advanced_reports pasamos dummies y espiamos el
// método privado `request` (que en producción hace la llamada HTTP).
const makeService = () =>
  new MoodleService(
    { db: {} } as any, // databaseService
    {} as any,         // courseRepository
    {} as any,         // groupRepository
    {} as any,         // organizationRepository
    {} as any,         // userCourseRepository
    {} as any,         // userRepository
    {} as any,         // userGroupRepository
    {} as any,         // moodleUserService
    {} as any,         // groupService
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
