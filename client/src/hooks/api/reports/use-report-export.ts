import { useCallback } from 'react';
import { useExportReportMutation, ReportExportRequest } from './use-export-report.mutation';
import type { AxiosResponse } from 'axios';

/**
 * Hook that wraps the low-level mutation and provides a simple helper to
 * request an export and trigger a browser download. Keeps the download
 * logic in a single place for reuse across routes/components.
 */
export const useReportExport = () => {
  const mutation = useExportReportMutation();

  const exportPdf = useCallback(async (payload: ReportExportRequest & { filename?: string }) => {
    const fallbackFilename = payload.filename ?? 'report.pdf';
    const { filename: _f, ...body } = payload;
    // body is a ReportExportRequest (without client-only `filename`)
    const resp = await mutation.mutateAsync(body as ReportExportRequest);
    const axiosResp = resp as AxiosResponse<Blob>;
    const contentType = String(axiosResp?.headers?.['content-type'] ?? 'application/pdf');
    const disposition = String(axiosResp?.headers?.['content-disposition'] ?? '');
    const match = disposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
    const headerFilename = decodeURIComponent((match?.[1] ?? match?.[2] ?? '').trim());
    const normalizedType = contentType.toLowerCase();
    const filename = headerFilename || (
      normalizedType.includes('application/pdf')
        ? (fallbackFilename.toLowerCase().endsWith('.zip') ? fallbackFilename.replace(/\.zip$/i, '.pdf') : fallbackFilename)
        : fallbackFilename
    );
    const blobData = axiosResp?.data ?? resp;
    const blob = new Blob([blobData], { type: contentType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    return true;
  }, [mutation]);

  return {
    ...mutation,
    exportPdf,
  } as const;
};

export default useReportExport;
