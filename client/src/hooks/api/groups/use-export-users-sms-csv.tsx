import { useCallback } from 'react';
import { useAuthenticatedAxios } from '../../../utils/api/use-authenticated-axios.util';
import { getApiHost } from '../../../utils/api/get-api-host.util';
import type { User } from '../../../shared/types/user/user';
import type { MoodleUserSelectModel } from '../../../shared/types/moodle/moodle-user.types';
import type { Course } from '../../../shared/types/course/course';
import { saveCsv, safeFilename } from '../../../utils/export-utils';

type ExportRow = [string, string, string];

/**
 * Hook to export selected users to a CSV file for SMS sending (no header, 3 columns: phone, message, sender).
 * Message format:
 * Bienvenido al curso de [Nombre corto del curso]. Acceda a http://formacion.mecohisa.com  USUARIO:[usuario] Clave:[contraseña] Soporte:976222324 teleformacion@mecohisa.com
 */
export const useExportUsersToSmsCsv = () => {
  const moodleRequest = useAuthenticatedAxios<MoodleUserSelectModel[]>();
  const courseRequest = useAuthenticatedAxios<Course>();

  const fetchMoodleForUser = async (id_user: number): Promise<MoodleUserSelectModel[]> => {
    try {
      const resp = await moodleRequest({ method: 'GET', url: `${getApiHost()}/moodle-user/by-user/${id_user}` });
      return (resp.data as MoodleUserSelectModel[]) ?? [];
    } catch (err) {
      return [];
    }
  };

  // Local batcher: fetch Moodle accounts for provided users with limited concurrency.
  const fetchMoodleBatch = async (users: User[], concurrency = 6): Promise<MoodleUserSelectModel[][]> => {
    const results: MoodleUserSelectModel[][] = [];
    for (let i = 0; i < users.length; i += concurrency) {
      const batch = users.slice(i, i + concurrency);
      const batchPromises = batch.map(u => fetchMoodleForUser(u.id_user));
      // eslint-disable-next-line no-await-in-loop
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    return results;
  };

  const exportSelected = useCallback(async (selectedUserIds: number[], usersData: User[], courseIdOrShortName?: number | string, groupName?: string) => {
  const selected = selectedUserIds.map(id => usersData.find(u => u.id_user === id)).filter(Boolean) as User[];
  if (selected.length === 0) throw new Error('No users selected');

  // Filter out users without phone — SMS export requires a phone number
  const withPhone = selected.filter(u => String(u.phone ?? '').trim() !== '');
  if (withPhone.length === 0) {
    const missingPhoneNames = selected.map(u => `${u.name} ${u.first_surname}`).join(', ');
    throw new Error(`Usuarios sin teléfono: ${missingPhoneNames}. Por favor, registra números de teléfono para poder exportar a SMS.`);
  }

  // Obtain course short name only when needed (lazy fetch). The caller can pass either the
    // short name string or a course id (number|string). If course id is provided we fetch the
    // course info on demand via the authenticated request.
    let courseShortName: string | undefined = undefined;
    if (typeof courseIdOrShortName === 'string' && courseIdOrShortName !== '' && isNaN(Number(courseIdOrShortName))) {
      courseShortName = courseIdOrShortName;
    } else if (typeof courseIdOrShortName === 'number' || (typeof courseIdOrShortName === 'string' && String(courseIdOrShortName).trim() !== '')) {
      // treat as id and fetch course
      try {
        const id = String(courseIdOrShortName);
        // backend course endpoint is singular `/course/{id}` (see useCourseQuery)
        const resp = await courseRequest({ method: 'GET', url: `${getApiHost()}/course/${id}` });
        courseShortName = (resp?.data as Course)?.short_name ?? undefined;
      } catch (e) {
        // ignore and continue without short name
        courseShortName = undefined;
      }
    }

  const moodleResults = await fetchMoodleBatch(withPhone, 6);

    const rows: ExportRow[] = withPhone.map((u, idx) => {
      const moodleArr = moodleResults[idx] ?? [];
      const main = (moodleArr.find((m: MoodleUserSelectModel) => m.is_main_user) ?? moodleArr[0]) ?? null;

      const username = main?.moodle_username ?? (u.dni ?? `user${u.id_user}`) ?? u.email;
      const password = main?.moodle_password ?? '';
  const telefono = (u.phone ?? '').toString();

  const message = `Bienvenido al curso de ${courseShortName ?? ''}. Acceda a http://formacion.mecohisa.com  USUARIO:${username} Clave:${password} Soporte:976222324 teleformacion@mecohisa.com`;

      return [telefono, message, 'MECOHISA'];
    });

    // Build SMS CSV with strict format:
    // - separator: ;
    // - message field ALWAYS quoted with double quotes (escape inner quotes)
    // - phone and sender NOT quoted
    // - UTF-8 without BOM
    const csv = rows
      .map(([phone, msg, sender]) => {
        const safeMsg = String(msg ?? '').replace(/"/g, '""');
        return `${String(phone ?? '')};"${safeMsg}";${String(sender ?? '')}`;
      })
      .join('\r\n');
    const filename = safeFilename(`${(groupName ?? courseShortName ?? 'grupo')}_SMS.csv`);
    const saved = await saveCsv(csv, filename);
    if (saved.cancelled) return { filename: '', rowsCount: 0 };
    return { filename: saved.filename, rowsCount: rows.length };
  }, [moodleRequest, courseRequest]);

  return exportSelected;
};

export default useExportUsersToSmsCsv;
