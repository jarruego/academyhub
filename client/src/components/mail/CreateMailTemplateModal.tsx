import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import z from 'zod';
import { Modal, Input, Switch, Form, Space, Tooltip, Button } from 'antd';
import { useCreateMailTemplateMutation, useUploadMailTemplateImageMutation } from '../../hooks/api/mail/use-mail-templates';
import { MAIL_TEMPLATE_VARIABLES } from '../../constants/mail/mail-template-variables';
import MailTemplateHtmlEditor from './MailTemplateHtmlEditor';
import type { Editor } from '@tiptap/react';

const MailTemplateSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  subject: z.string().min(1, 'El asunto es obligatorio'),
  content: z.string().min(1, 'El contenido es obligatorio'),
  is_html: z.boolean(),
});

type MailTemplateForm = z.infer<typeof MailTemplateSchema>;

interface CreateMailTemplateModalProps {
  open: boolean;
  onOk?: () => void;
  onCancel: () => void;
}

export default function CreateMailTemplateModal({ open, onOk, onCancel }: CreateMailTemplateModalProps) {
  const { mutateAsync, isPending } = useCreateMailTemplateMutation();
  const { mutateAsync: uploadImage, isPending: isUploadingImage } = useUploadMailTemplateImageMutation();
  const { handleSubmit, control, reset, setValue, getValues, watch, formState: { errors, isSubmitting } } = useForm<MailTemplateForm>({
    resolver: zodResolver(MailTemplateSchema),
    defaultValues: { name: '', subject: '', content: '', is_html: false },
    mode: 'onBlur',
  });

  const submit = async (values: MailTemplateForm) => {
    await mutateAsync(values);
    reset();
    onOk?.();
  };

  // Variables disponibles (compartidas)
  const variables = MAIL_TEMPLATE_VARIABLES;
  const isHtml = watch('is_html');
  const htmlEditorRef = React.useRef<Editor | null>(null);

  // Ref para el textarea
  const textareaRef = React.useRef<any>(null);

  // Inserta la variable en la posición del cursor
  const insertVariable = (variable: string) => {
    if (isHtml && htmlEditorRef.current) {
      htmlEditorRef.current.chain().focus().insertContent(variable).run();
      return;
    }

    const textarea = textareaRef.current?.resizableTextArea?.textArea;
    if (!textarea) {
      const current = getValues('content') || '';
      setValue('content', `${current}${variable}`, { shouldDirty: true });
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;
    const newValue = value.slice(0, start) + variable + value.slice(end);
    setValue('content', newValue, { shouldDirty: true });
    // Devuelve el foco y mueve el cursor
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + variable.length;
    }, 0);
  };

  return (
    <Modal
      title="Nueva plantilla de correo"
      open={open}
      onOk={handleSubmit(submit)}
      onCancel={() => { reset(); onCancel(); }}
      confirmLoading={isSubmitting || isPending || isUploadingImage}
      okText="Crear"
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
        <Form.Item label="Asunto" validateStatus={errors.subject ? 'error' : ''} help={errors.subject?.message}>
          <Controller
            name="subject"
            control={control}
            render={({ field }) => <Input {...field} autoComplete="off" />}
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
              if (isHtml) {
                return (
                  <MailTemplateHtmlEditor
                    value={field.value}
                    onChange={field.onChange}
                    onReady={(editor) => {
                      htmlEditorRef.current = editor;
                    }}
                    onUploadImage={async (file) => {
                      const uploaded = await uploadImage(file);
                      return uploaded.url;
                    }}
                  />
                );
              }

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
