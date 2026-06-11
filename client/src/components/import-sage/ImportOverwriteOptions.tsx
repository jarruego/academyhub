import React from 'react';
import { Alert, Checkbox, Space } from 'antd';
import { ImportOverwriteOptions } from '../../types/import.types';

interface FieldDef {
  key: keyof ImportOverwriteOptions;
  label: string;
  phrase: string; // cómo se nombra el campo en el aviso
}

const FIELDS: FieldDef[] = [
  { key: 'overwriteGender', label: 'Sobrescribir el sexo de todos los usuarios con el valor del CSV', phrase: 'el sexo' },
  { key: 'overwriteSalaryGroup', label: 'Sobrescribir el grupo de cotización de todos los usuarios con el valor del CSV', phrase: 'el grupo de cotización' },
  { key: 'overwriteBirthDate', label: 'Sobrescribir la fecha de nacimiento de todos los usuarios con el valor del CSV', phrase: 'la fecha de nacimiento' },
  { key: 'overwriteEducationLevel', label: 'Sobrescribir el nivel de estudios de todos los usuarios con el valor del CSV', phrase: 'el nivel de estudios' },
];

const joinPhrases = (phrases: string[]) =>
  phrases.length > 1
    ? `${phrases.slice(0, -1).join(', ')} y ${phrases[phrases.length - 1]}`
    : phrases[0];

interface Props {
  value: ImportOverwriteOptions;
  onChange: (value: ImportOverwriteOptions) => void;
  disabled?: boolean;
}

export const ImportOverwriteOptionsForm: React.FC<Props> = ({ value, onChange, disabled }) => {
  const activePhrases = FIELDS.filter(f => value[f.key]).map(f => f.phrase);

  return (
    <div>
      <Space direction="vertical" size={4}>
        {FIELDS.map(f => (
          <Checkbox
            key={f.key}
            checked={value[f.key]}
            onChange={(e) => onChange({ ...value, [f.key]: e.target.checked })}
            disabled={disabled}
          >
            {f.label}
          </Checkbox>
        ))}
      </Space>
      {activePhrases.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginTop: 8 }}
          message={`Se sobrescribirá ${joinPhrases(activePhrases)} en todos los usuarios del CSV, aunque ya tengan un valor asignado. El resto de campos no se verán afectados. Si el CSV no trae valor para un campo, ese usuario no se modifica.`}
        />
      )}
    </div>
  );
};
