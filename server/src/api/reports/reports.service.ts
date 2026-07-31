import { Injectable } from '@nestjs/common';
import { ReportsRepository } from 'src/database/repository/reports/reports.repository';
import { ReportFilterDTO } from 'src/dto/reports/report-filter.dto';
import { ReportRowDTO } from 'src/dto/reports/report-row.dto';

/** Selección de filas compartida por export (/reports/export) y envío (/reports/send). */
export interface ReportRowsSelection {
  filter?: ReportFilterDTO;
  selected_keys?: string[];
  select_all_matching?: boolean;
  deselected_keys?: string[];
}

@Injectable()
export class ReportsService {
  constructor(private readonly reportsRepository: ReportsRepository) {}

  async findAll(filter?: ReportFilterDTO) {
    return this.reportsRepository.getReportRows(filter);
  }

  async getFacets(filter?: ReportFilterDTO) {
    return this.reportsRepository.getReportFacets(filter);
  }

  async getRowsByKeys(keys: string[]) {
    return this.reportsRepository.getReportRowsByKeys(keys);
  }

  async getRoles() {
    return this.reportsRepository.getReportRoles();
  }

  /**
   * Resuelve las filas de informe a partir de una selección explícita
   * (selected_keys), de un "seleccionar todo lo que matchea" con
   * deselecciones, o de un filtro puro. Compartido por el export a PDF y el
   * envío por correo para no duplicar esta lógica en dos sitios.
   */
  async resolveRows(selection: ReportRowsSelection): Promise<ReportRowDTO[]> {
    const { filter, selected_keys, select_all_matching, deselected_keys } = selection;

    if (Array.isArray(selected_keys) && selected_keys.length) {
      const data = await this.getRowsByKeys(selected_keys);
      return Array.isArray(data) ? data : (data?.data ?? []);
    }

    const exportFilter = { ...(filter ?? {}), page: 1, limit: 100000 } as ReportFilterDTO;

    if (select_all_matching) {
      const data = await this.findAll(exportFilter);
      let rows: ReportRowDTO[] = data?.data ?? [];
      const deselected: string[] = Array.isArray(deselected_keys) ? deselected_keys : [];
      if (deselected.length) {
        rows = rows.filter((r) => {
          const key = (r.id_user != null && r.id_group != null) ? `${r.id_user}-${r.id_group}` : `${r.dni ?? ''}-${r.moodle_id ?? ''}`;
          return !deselected.includes(key);
        });
      }
      return rows;
    }

    const data = await this.findAll(exportFilter);
    return data?.data ?? [];
  }
}
