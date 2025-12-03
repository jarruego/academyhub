export type TemplateStyle = {
  font?: string;
  fontSize?: number;
  align?: 'left' | 'center' | 'right';
};

export type TemplateElement =
  | { type: 'title'; text: string; style?: string }
  | { type: 'paragraph'; text: string; style?: string }
  | { type: 'image'; var: string; width?: number; position?: 'top-right' | 'bottom-right' | 'top-left' }
  | { type: 'table'; rowsVar: string; columns: Array<{ title: string; path: string }>; headerStyle?: string; cellStyle?: string }
  | { type: 'header'; text: string; style?: string };

export type ReportTemplate = {
  meta?: { id?: string; title?: string };
  variables?: string[];
  styles?: Record<string, TemplateStyle>;
  pages: Array<{ elements: TemplateElement[] }>;
};
