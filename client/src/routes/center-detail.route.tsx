import { useParams, useNavigate } from "react-router-dom";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { Button, Form, Input, message } from "antd";
import { useCenterQuery } from "../hooks/api/centers/use-center.query";
import { useUpdateCenterMutation } from "../hooks/api/centers/use-update-center.mutation";
import { useDeleteCenterMutation } from "../hooks/api/centers/use-delete-center.mutation";
import { Center } from "../shared/types/center/center";
import { useEffect } from "react";
import { DeleteOutlined, SaveOutlined } from "@ant-design/icons"; // Importar los iconos

export default function EditCenterRoute() {
  const { id_center } = useParams();
  const navigate = useNavigate();
  const { data: centerData, isLoading: isCenterLoading } = useCenterQuery(id_center || "");
  const { mutateAsync: updateCenter } = useUpdateCenterMutation(id_center || "");
  const { mutateAsync: deleteCenter } = useDeleteCenterMutation(id_center || "");
  const { handleSubmit, control, reset } = useForm<Center>();

  useEffect(() => {
    document.title = `Detalle del Centro ${id_center}`;
  }, [id_center]);

  useEffect(() => {
    if (centerData) {
      reset(centerData);
    }
  }, [centerData, reset]);

  if (isCenterLoading) return <div>Cargando...</div>;

  const submit: SubmitHandler<Center> = async (data) => {
    try {
      await updateCenter(data);
      message.success('Centro actualizado exitosamente');
      navigate(`/companies/${centerData?.id_company}`);
    } catch {
      message.error('No se pudo actualizar el centro');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteCenter();
      message.success('Centro eliminado exitosamente');
      navigate(`/companies/${centerData?.id_company}`);
    } catch {
      message.error('No se pudo eliminar el centro');
    }
  };

  return (
    <div>
      <Form layout="vertical" onFinish={handleSubmit(submit)}>
        <Form.Item label="ID del centro" name="id_center">
          <Controller name="id_center" control={control} render={({ field }) => <Input {...field} disabled />} />
        </Form.Item>
        <Form.Item label="Nombre del centro" name="center_name">
          <Controller name="center_name" control={control} render={({ field }) => <Input {...field} />} />
        </Form.Item>
        <Form.Item label="Número de empleados" name="employer_number">
          <Controller name="employer_number" control={control} render={({ field }) => <Input {...field} />} />
        </Form.Item>
        <Form.Item label="Persona de contacto" name="contact_person">
          <Controller name="contact_person" control={control} render={({ field }) => <Input {...field} />} />
        </Form.Item>
        <Form.Item label="Teléfono de contacto" name="contact_phone">
          <Controller name="contact_phone" control={control} render={({ field }) => <Input {...field} />} />
        </Form.Item>
        <Form.Item label="Email de contacto" name="contact_email">
          <Controller name="contact_email" control={control} render={({ field }) => <Input {...field} />} />
        </Form.Item>
        <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>Guardar</Button>
        <Button type="primary" danger onClick={handleDelete} style={{ marginLeft: '16px' }} icon={<DeleteOutlined />}>Eliminar Centro</Button>
      </Form>
    </div>
  );
}
