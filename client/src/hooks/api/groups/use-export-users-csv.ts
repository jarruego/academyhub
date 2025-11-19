import { useCallback } from 'react';
import { useAuthenticatedAxios } from '../../../utils/api/use-authenticated-axios.util';
import { getApiHost } from '../../../utils/api/get-api-host.util';
import type { User } from '../../../shared/types/user/user';
import type { MoodleUserSelectModel } from '../../../shared/types/moodle/moodle-user.types';

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
export const useExportUsersToCsv = () => {
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
      const main = (moodleArr.find((m: any) => m.is_main_user) || moodleArr[0]) || null;

      const username = main?.moodle_username ?? u.email ?? (u.dni ?? `user${u.id_user}`);
      const password = main?.moodle_password ?? '';
      const firstName = u.name ?? '';
      const secondName = [u.first_surname ?? '', u.second_surname ?? ''].filter(Boolean).join(' ');
      const email = u.email ?? '';
      const phone1 = u.phone ?? '';
      const dni = u.dni ?? '';
  const company = (u.centers && u.centers.length > 0) ? (u.centers.find((c: any) => (c as any).is_main_center) ?? u.centers[0]).company_name ?? '' : '';
      const porcentajeRaw = u.completion_percentage ?? 0;
      const porcentaje = (typeof porcentajeRaw === 'number' && porcentajeRaw > 0 && porcentajeRaw <= 1) ? (porcentajeRaw * 100).toString() : String(porcentajeRaw ?? '0');
  const centro = (u.centers && u.centers.length > 0) ? (u.centers.find((c: any) => (c as any).is_main_center) ?? u.centers[0]).center_name ?? '' : '';
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

    // CSV building: semicolon separator, CRLF, UTF-8 BOM
    const SEP = ';';
    const header = ['UserName', 'Password', 'FirstName', 'SecondName', 'email', 'phone1', 'dni', 'Empresa', 'Porcentaje', 'centro', 'Grupo'];
    const escape = (v: unknown) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r') || s.includes(SEP)) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };

    const csvLines = [header.join(SEP)];
    for (const r of rows) {
      const line = [r.usuario, r.contraseña, r.nombre, r.apellido, r.email, r.telefono, r.dni, r.empresa, r.porcentaje, r.centro, r.grupo].map(escape).join(SEP);
      csvLines.push(line);
    }

    const csv = '\uFEFF' + csvLines.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const filename = `${(groupName ?? 'usuarios')}_export.csv`.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);

    return { filename, rowsCount: rows.length };
  }, [request]);

  return exportSelected;
};

export default useExportUsersToCsv;
