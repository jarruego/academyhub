import { useCallback } from 'react';
import { useAuthenticatedAxios } from '../../../utils/api/use-authenticated-axios.util';
import { getApiHost } from '../../../utils/api/get-api-host.util';
import type { User } from '../../../shared/types/user/user';
import type { MoodleUserSelectModel } from '../../../shared/types/moodle/moodle-user.types';
import { buildCsv, saveCsv, safeFilename } from '../../../utils/export-utils';

type ExportRow = {
  usuario: string;
  contraseña: string;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  dni: string;
  empresa: string;
  porcentaje: string;
  centro: string;
  grupo: string;
};

/**
 * Hook to export selected users to a CSV file compatible with Excel (UTF-8 BOM, ; separator, CRLF).
 * It attempts to fetch Moodle accounts per user to include username/password when available.
 */
export const useExportUsersToMailCsv = () => {
  const request = useAuthenticatedAxios<MoodleUserSelectModel[]>();

  // Fetch moodle accounts for a single user id (returns array or empty array on error)
  const fetchMoodleForUser = async (id_user: number): Promise<MoodleUserSelectModel[]> => {
    try {
      const resp = await request({ method: 'GET', url: `${getApiHost()}/moodle-user/by-user/${id_user}` });
      return resp.data ?? [];
    } catch (err) {
      return [];
    }
  };

  // Fetch moodle accounts for all users but limit concurrency by processing chunks
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

  const exportSelected = useCallback(async (selectedUserIds: number[], usersData: User[], groupName?: string) => {
    const selected = selectedUserIds.map(id => usersData.find(u => u.id_user === id)).filter(Boolean) as User[];
    if (selected.length === 0) throw new Error('No users selected');

    // get moodle results in batches to avoid bursts
    const moodleResults = await fetchMoodleBatch(selected, 6);

    const rows: ExportRow[] = selected.map((u, idx) => {
      const moodleArr = moodleResults[idx] ?? [];
      const main = (moodleArr.find((m) => m.is_main_user) ?? moodleArr[0]) ?? null;

      const username = main?.moodle_username ?? (u.dni ?? `user${u.id_user}`) ?? u.email;
      const password = main?.moodle_password ?? '';
      const firstName = u.name ?? '';
      const secondName = [u.first_surname ?? '', u.second_surname ?? ''].filter(Boolean).join(' ');
      const email = u.email ?? '';
      const phone1 = u.phone ?? '';
      const dni = u.dni ?? '';
      const mainCenter = (u.centers && u.centers.length > 0) ? (u.centers.find((c) => c.is_main_center) ?? u.centers[0]) : undefined;
      const company = mainCenter ? mainCenter.company_name ?? '' : '';
      const porcentajeRaw = u.completion_percentage ?? 0;
      const porcentaje = (typeof porcentajeRaw === 'number' && porcentajeRaw > 0 && porcentajeRaw <= 1) ? (porcentajeRaw * 100).toString() : String(porcentajeRaw ?? '0');
      const centro = mainCenter ? mainCenter.center_name ?? '' : '';
      const grupo = groupName ?? '';

      return {
        usuario: username,
        contraseña: password,
        nombre: firstName,
        apellido: secondName,
        email,
        telefono: phone1,
        dni,
        empresa: company,
        porcentaje,
        centro,
        grupo,
      };
    });

    // CSV building using shared helper
    const header = ['UserName', 'Password', 'FirstName', 'SecondName', 'email', 'phone1', 'dni', 'Empresa', 'Porcentaje', 'centro', 'Grupo'];
    const csv = buildCsv(rows.map(r => [r.usuario, r.contraseña, r.nombre, r.apellido, r.email, r.telefono, r.dni, r.empresa, r.porcentaje, r.centro, r.grupo]), header);
    const filename = safeFilename(`${(groupName ?? 'usuarios')}_MAIL.csv`);

    const saved = await saveCsv(csv, filename);
    if (saved.cancelled) return { filename: '', rowsCount: 0 };
    return { filename: saved.filename, rowsCount: rows.length };
  }, [request]);

  return exportSelected;
};

export default useExportUsersToMailCsv;
