import { Button, Col, Form, Input, InputNumber, Row, Select } from "antd";
import { SaveOutlined } from "@ant-design/icons";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import z from "zod";
import { CourseModality } from "../../shared/types/course/course-modality.enum";
import { CatalogCourseInput } from "../../shared/types/course-catalog/course-catalog";

const schema = z.object({
  name: z.string().trim().min(2, "La denominación es obligatoria"),
  internal_code: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  objectives: z.string().optional().nullable(),
  base_contents: z.string().optional().nullable(),
  default_modality: z.nativeEnum(CourseModality).optional().nullable(),
  default_hours: z.coerce.number().int().min(0).optional().nullable(),
  sepe_specialty_code: z.string().optional().nullable(),
  sepe_specialty_name: z.string().optional().nullable(),
  professional_family: z.string().optional().nullable(),
  professional_area: z.string().optional().nullable(),
});

type Values = z.infer<typeof schema>;

export function CatalogCourseForm({ initial, readOnly = false, saving = false, onSubmit }: {
  initial?: Partial<Values>;
  readOnly?: boolean;
  saving?: boolean;
  onSubmit: (values: CatalogCourseInput) => Promise<void>;
}) {
  const { control, handleSubmit, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    values: {
      name: initial?.name ?? "",
      internal_code: initial?.internal_code ?? "",
      description: initial?.description ?? "",
      objectives: initial?.objectives ?? "",
      base_contents: initial?.base_contents ?? "",
      default_modality: initial?.default_modality ?? null,
      default_hours: initial?.default_hours ?? null,
      sepe_specialty_code: initial?.sepe_specialty_code ?? "",
      sepe_specialty_name: initial?.sepe_specialty_name ?? "",
      professional_family: initial?.professional_family ?? "",
      professional_area: initial?.professional_area ?? "",
    },
  });
  const input = (name: keyof Values, multiline = false) => (
    <Controller name={name} control={control} render={({ field }) => multiline
      ? <Input.TextArea {...field} value={(field.value as string | null) ?? ""} rows={3} readOnly={readOnly} />
      : <Input {...field} value={(field.value as string | null) ?? ""} readOnly={readOnly} />
    } />
  );
  return <Form layout="vertical" onFinish={handleSubmit((values) => onSubmit(values as CatalogCourseInput))}>
    <Row gutter={[16, 0]}>
      <Col xs={24} md={16}><Form.Item label="Denominación" required validateStatus={errors.name ? "error" : undefined} help={errors.name?.message}>{input("name")}</Form.Item></Col>
      <Col xs={24} sm={12} md={8}><Form.Item label="Código interno">{input("internal_code")}</Form.Item></Col>
    </Row>
    <Row gutter={[16, 0]}>
      <Col xs={24} md={12}><Form.Item label="Descripción">{input("description", true)}</Form.Item></Col>
      <Col xs={24} md={12}><Form.Item label="Objetivos">{input("objectives", true)}</Form.Item></Col>
    </Row>
    <Row gutter={[16, 0]}>
      <Col xs={24} sm={12} md={6}><Form.Item label="Modalidad habitual"><Controller name="default_modality" control={control} render={({ field }) => <Select {...field} value={field.value ?? undefined} allowClear disabled={readOnly} options={Object.values(CourseModality).map(value => ({ value, label: value }))} />}/></Form.Item></Col>
      <Col xs={24} sm={12} md={4}><Form.Item label="Horas habituales"><Controller name="default_hours" control={control} render={({ field }) => <InputNumber {...field} value={field.value ?? null} min={0} disabled={readOnly} style={{width:"100%"}} />}/></Form.Item></Col>
      <Col xs={24} sm={12} md={7}><Form.Item label="Código especialidad SEPE">{input("sepe_specialty_code")}</Form.Item></Col>
      <Col xs={24} sm={12} md={7}><Form.Item label="Denominación oficial SEPE">{input("sepe_specialty_name")}</Form.Item></Col>
    </Row>
    <Row gutter={[16, 0]}>
      <Col xs={24} md={12}><Form.Item label="Familia profesional">{input("professional_family")}</Form.Item></Col>
      <Col xs={24} md={12}><Form.Item label="Área profesional">{input("professional_area")}</Form.Item></Col>
    </Row>
    <Form.Item label="Contenidos base">{input("base_contents", true)}</Form.Item>
    {!readOnly && <div className="form-actions"><Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>Guardar</Button></div>}
  </Form>;
}
