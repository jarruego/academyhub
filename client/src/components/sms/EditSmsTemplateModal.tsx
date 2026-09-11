import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import z from 'zod';
import { Modal, Input, Form, Space, Tooltip, Button, Typography } from 'antd';
import type { TextAreaRef } from 'antd/es/input/TextArea';
import { useUpdateSmsTemplateMutation } from '../../hooks/api/sms/use-sms-templates';
import { MAIL_TEMPLATE_VARIABLES } from '../../constants/mail/mail-template-variables';
import { estimateSmsLength } from '../../utils/sms/sms-length.util';

const SmsTemplateSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  message: z.string().min(1, 'El mensaje es obligatorio'),
});

type SmsTemplateForm = z.infer<typeof SmsTemplateSchema>;

interface EditSmsTemplateModalProps {
  open: boolean;
  template: {
    id: number;
    name: string;
    message: string;
  } | null;
  onOk?: () => void;
  onCancel: () => void;
}

export default function EditSmsTemplateModal({ open, template, onOk, onCancel }: EditSmsTemplateModalProps) {
  const { mutateAsync, status } = useUpdateSmsTemplateMutation();
  const { handleSubmit, control, reset, setValue, getValues, watch, formState: { errors, isSubmitting } } = useForm<SmsTemplateForm>({
    resolver: zodResolver(SmsTemplateSchema),
    defaultValues: template || { name: '', message: '' },
    mode: 'onBlur',
  });

  React.useEffect(() => {
    if (template) {
      reset({ name: template.name, message: template.message });
    }
  }, [template, reset]);

  const submit = async (values: SmsTemplateForm) => {
    if (!template) return;
    await mutateAsync({ id: template.id, ...values });
    onOk?.();
  };

  const message = watch('message') || '';
  const { length, parts, encoding } = estimateSmsLength(message);
  const textareaRef = React.useRef<TextAreaRef>(null);

  const insertVariable = (variable: string) => {
    const textarea = textareaRef.current?.resizableTextArea?.textArea;
    if (!textarea) {
      const current = getValues('message') || '';
      setValue('message', `${current}${variable}`, { shouldDirty: true });
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;
    const newValue = value.slice(0, start) + variable + value.slice(end);
    setValue('message', newValue, { shouldDirty: true });
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + variable.length;
    }, 0);
  };

  return (
    <Modal
      title="Editar plantilla de SMS"
      open={open}
      onOk={handleSubmit(submit)}
      onCancel={onCancel}
      confirmLoading={isSubmitting || status === 'pending'}
      okText="Guardar"
      destroyOnClose
      width={560}
    >
      <Form layout="vertical">
        <Form.Item label="Nombre" validateStatus={errors.name ? 'error' : ''} help={errors.name?.message}>
          <Controller
            name="name"
            control={control}
            render={({ field }) => <Input {...field} autoFocus autoComplete="off" />}
          />
        </Form.Item>
        <Form.Item label="Mensaje" validateStatus={errors.message ? 'error' : ''} help={errors.message?.message}>
          <Space style={{ marginBottom: 8, flexWrap: 'wrap' }}>
            {MAIL_TEMPLATE_VARIABLES.map((v) => (
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
            name="message"
            control={control}
            render={({ field }) => <Input.TextArea {...field} ref={textareaRef} rows={6} />}
          />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {length} caracteres · {encoding} · {parts || 0} parte{parts === 1 ? '' : 's'} (estimado)
          </Typography.Text>
        </Form.Item>
      </Form>
    </Modal>
  );
}
