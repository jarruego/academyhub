import React from 'react';
import { Input } from 'antd';

interface HtmlEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
}

// Simple HTML editor using Ant Design's TextArea for now
const HtmlEditor: React.FC<HtmlEditorProps> = ({ value, onChange, readOnly }) => {
  return (
    <Input.TextArea
      value={value}
      onChange={e => onChange?.(e.target.value)}
      autoSize={{ minRows: 8, maxRows: 24 }}
      readOnly={readOnly}
      placeholder="Introduce el contenido HTML del curso aquí..."
      style={{ fontFamily: 'monospace', fontSize: 14 }}
    />
  );
};

export default HtmlEditor;
