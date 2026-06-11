import React from 'react';
import { ImportSummary } from '../../types/import.types';

const MAX_SHOWN = 10;

interface Props {
  summary: ImportSummary;
}

/**
 * Descripción del Alert de errores del resumen de importación: además del
 * recuento, lista fila y causa de cada error (hasta MAX_SHOWN).
 */
export const ImportErrorDetails: React.FC<Props> = ({ summary }) => {
  const details = summary.error_details ?? [];

  return (
    <div>
      <p style={{ marginTop: 0, marginBottom: details.length > 0 ? 8 : 0 }}>
        Se encontraron {summary.errors} errores durante el procesamiento.
      </p>
      {details.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          {details.slice(0, MAX_SHOWN).map((d, i) => (
            <li key={i}>
              {d.row > 0 ? <strong>Fila {d.row}: </strong> : null}
              {d.message}
            </li>
          ))}
          {details.length > MAX_SHOWN && (
            <li>… y {details.length - MAX_SHOWN} errores más (revisa los logs del servidor)</li>
          )}
        </ul>
      )}
    </div>
  );
};
