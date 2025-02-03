import { useCreateCompanyMutation } from "../hooks/api/companies/use-create-company.mutation";
import { Button, Form, Input, message } from "antd";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { Company } from "../shared/types/company/company";
import { useNavigate } from "react-router-dom";
import { SaveOutlined, ReloadOutlined } from "@ant-design/icons"; // Importar el icono

export default function CreateCompanyRoute() {
  const { mutateAsync: createCompany } = useCreateCompanyMutation();
  const { handleSubmit, control } = useForm<Company>();
  const navigate = useNavigate();

  const submit: SubmitHandler<Company> = async (info) => {
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
        <Form.Item label="Nombre de la empresa" name="company_name" required={true}>
          <Controller name="company_name" control={control} render={({ field }) => <Input {...field} />} />
        </Form.Item>
        <Form.Item label="Razón Social" name="corporate_name" required={true}>
          <Controller name="corporate_name" control={control} render={({ field }) => <Input {...field} />} />
        </Form.Item>
        <Form.Item label="CIF" name="cif" required={true}>
          <Controller name="cif" control={control} render={({ field }) => <Input {...field} />} />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>
            Guardar
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => window.location.reload()} style={{ marginLeft: '16px' }}>
            Refrescar
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
}
