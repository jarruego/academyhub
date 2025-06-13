import { useCreateCompanyMutation } from "../../hooks/api/companies/use-create-company.mutation";
import { Button, Form, Input, message } from "antd";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { SaveOutlined } from "@ant-design/icons";
import { useEffect } from "react";
import z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { CIF_SCHEMA } from "../../schemas/cif.schema"; 


const CREATE_COMPANY_FORM = z.object({
  company_name: z.string({ required_error: "El nombre es obligatorio" }).min(2, "El nombre no puede ser tan corto"),
  corporate_name: z.string({ required_error: "La razón social es obligatoria" }).min(2, "La razón social no puede ser tan corta"),
  cif: CIF_SCHEMA, 
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
});

export default function CreateCompanyRoute() {
  const { mutateAsync: createCompany } = useCreateCompanyMutation();

  const { handleSubmit, control, formState: { errors } } = useForm<z.infer<typeof CREATE_COMPANY_FORM>>({
    resolver: zodResolver(CREATE_COMPANY_FORM)
  });
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Crear Empresa";
  }, []);

  const submit: SubmitHandler<z.infer<typeof CREATE_COMPANY_FORM>> = async (info) => {
    try {
      await createCompany(info);
      navigate('/companies');
    } catch {
      message.error('No se pudo guardar el formulario. Inténtalo de nuevo.');
    }
  }

  return (
    <div>
      <Form layout="vertical" onFinish={handleSubmit(submit)}>
        <Form.Item
          label="Nombre de la empresa"
          name="company_name"
          required={true}
          help={errors.company_name?.message}
          validateStatus={errors.company_name ? "error" : undefined}
        >
          <Controller name="company_name" control={control} render={({ field }) => <Input data-testid="company-name" {...field} />} />
        </Form.Item>
        <Form.Item
          label="Razón Social"
          name="corporate_name"
          required={true}
          help={errors.corporate_name?.message}
          validateStatus={errors.corporate_name ? "error" : undefined}
        >
          <Controller name="corporate_name" control={control} render={({ field }) => <Input data-testid="corporate-name" {...field} />} />
        </Form.Item>
        <Form.Item
          label="CIF"
          name="cif"
          required={true}
          help={errors.cif?.message}
          validateStatus={errors.cif ? "error" : undefined}
        >
          <Controller name="cif" control={control} render={({ field }) => <Input data-testid="cif" {...field} />} />
        </Form.Item>
        <div style={{ display: 'flex', gap: '16px' }}>
          <Button onClick={() => navigate(-1)}>
            Cancelar
          </Button>
          <Button type="primary" htmlType="submit" icon={<SaveOutlined />} data-testid="submit">
            Guardar
          </Button>
        </div>
      </Form>
    </div>
  );
}
