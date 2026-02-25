import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import z from 'zod';
import { Modal, Input, Switch, Form, Space, Tooltip, Button } from 'antd';
import { useUpdateMailTemplateMutation } from '../../hooks/api/mail/use-mail-templates';
import { MAIL_TEMPLATE_VARIABLES } from '../../constants/mail/mail-template-variables';

const MailTemplateSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  content: z.string().min(1, 'El contenido es obligatorio'),
  is_html: z.boolean(),
});

type MailTemplateForm = z.infer<typeof MailTemplateSchema>;

interface EditMailTemplateModalProps {
  open: boolean;
  template: {
    id: number;
    name: string;
    content: string;
    is_html: boolean;
  } | null;
  onOk?: () => void;
  onCancel: () => void;
}

export default function EditMailTemplateModal({ open, template, onOk, onCancel }: EditMailTemplateModalProps) {
  const { mutateAsync, status } = useUpdateMailTemplateMutation();
  const { handleSubmit, control, reset, formState: { errors, isSubmitting } } = useForm<MailTemplateForm>({
    resolver: zodResolver(MailTemplateSchema),
    defaultValues: template || { name: '', content: '', is_html: false },
    mode: 'onBlur',
  });

  // Reset form when template changes
  React.useEffect(() => {
    if (template) {
      reset({ name: template.name, content: template.content, is_html: template.is_html });
    }
  }, [template, reset]);

  const submit = async (values: MailTemplateForm) => {
    if (!template) return;
    await mutateAsync({ id: template.id, ...values });
    onOk?.();
  };

  // Variables disponibles (compartidas)
  const variables = MAIL_TEMPLATE_VARIABLES;

  // Ref para el textarea
  const textareaRef = React.useRef<any>(null);

  // Inserta la variable en la posición del cursor
  const insertVariable = (variable: string) => {
    const textarea = textareaRef.current?.resizableTextArea?.textArea;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;
    const newValue = value.slice(0, start) + variable + value.slice(end);
    // Actualiza el valor en el form
    fieldContent.onChange(newValue);
    // Devuelve el foco y mueve el cursor
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + variable.length;
    }, 0);
  };

  // Necesitamos capturar el field de content para poder actualizarlo desde insertVariable
  let fieldContent: any = null;

  return (
    <Modal
      title="Editar plantilla de correo"
      open={open}
      onOk={handleSubmit(submit)}
      onCancel={onCancel}
      confirmLoading={isSubmitting || status === 'pending'}
      okText="Guardar"
      destroyOnClose
      width={700}
      styles={{ body: { minHeight: 420 } }}
    >
      <Form layout="vertical">
        <Form.Item label="Nombre" validateStatus={errors.name ? 'error' : ''} help={errors.name?.message}>
          <Controller
            name="name"
            control={control}
            render={({ field }) => <Input {...field} autoFocus autoComplete="off" />}
          />
        </Form.Item>
        <Form.Item label="Contenido" validateStatus={errors.content ? 'error' : ''} help={errors.content?.message}>
          {/* Barra de variables */}
          <Space style={{ marginBottom: 8, flexWrap: 'wrap' }}>
            {variables.map(v => (
              <Tooltip title={v.label} key={v.key}>
                <Button 
                  size="small" 
                  type="text"
                  style={{ fontSize: 11, padding: '0 6px', height: 22, lineHeight: '20px' }}
                  onClick={() => insertVariable(v.key)}
                >
                  {v.key}
                </Button>
              </Tooltip>
            ))}
          </Space>
          <Controller
            name="content"
            control={control}
            render={({ field }) => {
              fieldContent = field;
              return <Input.TextArea {...field} ref={textareaRef} rows={14} style={{ minHeight: 260 }} />;
            }}
          />
        </Form.Item>
        <Form.Item label="¿Formato HTML?" valuePropName="checked">
          <Controller
            name="is_html"
            control={control}
            render={({ field }) => <Switch {...field} checked={field.value} />}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
