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
    const filename = payload.filename ?? 'report.pdf';
    const { filename: _f, ...body } = payload;
    // body is a ReportExportRequest (without client-only `filename`)
    const resp = await mutation.mutateAsync(body as ReportExportRequest);
    // axios response with blob in data
    const blobData = (resp as AxiosResponse<Blob>)?.data ?? resp;
    const blob = new Blob([blobData], { type: 'application/pdf' });
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
