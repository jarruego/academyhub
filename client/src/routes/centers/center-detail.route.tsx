import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useForm, Controller, SubmitHandler } from "react-hook-form";
import { App, Button, Checkbox, Form, Input, Row, Col } from "antd";
import { RouteTabs } from "../../components/common/RouteTabs";
import { DataTable } from "../../components/common/DataTable";
import { ListPageLayout } from "../../components/common/ListPageLayout";
import { useListSearch } from "../../hooks/use-list-search";
import { useListPagination } from "../../hooks/use-list-pagination";
import { useCenterQuery } from "../../hooks/api/centers/use-center.query";
import { useUpdateCenterMutation } from "../../hooks/api/centers/use-update-center.mutation";
import { useDeleteCenterMutation } from "../../hooks/api/centers/use-delete-center.mutation";
import { useCompanyQuery } from "../../hooks/api/companies/use-company.query";
import { useUsersQuery } from "../../hooks/api/users/use-users.query";
import { useEffect, useState } from "react";
import { DeleteOutlined, SaveOutlined } from "@ant-design/icons";
import z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthzHide } from "../../components/permissions/authz-hide";
import { Role } from "../../hooks/api/auth/use-login.mutation";
import { useRole } from "../../utils/permissions/use-role";
import { User } from "../../shared/types/user/user";
import { BajaTag } from "../../components/common/tags";

const CENTER_FORM_SCHEMA = z.object({
  id_center: z.number(),
  employer_number: z.string().optional().nullish(),
  center_name: z.string({ required_error: "El nombre del centro es obligatorio" }).min(2, "El nombre es demasiado corto"),
  id_company: z.number(),
  contact_person: z.string().optional().nullish(),
  contact_phone: z.string().optional().nullish(),
  contact_email: z.string().email("El email no es válido").optional().nullish(),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
});

export default function EditCenterRoute() {
  const { message, modal } = App.useApp();
  const { id_center } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const role = useRole();
  const canEdit = [Role.ADMIN, Role.MANAGER].includes(role);
  const { data: centerData, isLoading: isCenterLoading } = useCenterQuery(id_center || "");
  const { data: companyData, isLoading: isCompanyLoading } = useCompanyQuery(centerData?.id_company ? String(centerData.id_company) : "");
  const { mutateAsync: updateCenter } = useUpdateCenterMutation(id_center || "");
  const { mutateAsync: deleteCenter } = useDeleteCenterMutation(id_center || "");
  const { handleSubmit, control, reset, formState: { errors } } = useForm<z.infer<typeof CENTER_FORM_SCHEMA>>({
    resolver: zodResolver(CENTER_FORM_SCHEMA),
  });

  // Estado para la tabla de usuarios
  const { searchText, setSearchText, normalized: normalizedSearchText } = useListSearch();
  const [showInactive, setShowInactive] = useState(true);
  const [onlyMainCenter, setOnlyMainCenter] = useState(true);
  const { pagination, currentPage, pageSize, resetPage, handleTableChange } = useListPagination(0, "usuarios");

  // Query para usuarios del centro
  const { data: usersResponse, isLoading: isUsersLoading } = useUsersQuery({
    page: currentPage,
    limit: pageSize,
    search: normalizedSearchText,
    id_center: id_center,
    includeInactive: showInactive,
    mainCenterOnly: onlyMainCenter,
  });

  useEffect(() => {
    document.title = `Detalle del Centro ${id_center}`;
  }, [id_center]);

  useEffect(() => {
    if (centerData) {
      reset(centerData);
    }
  }, [centerData, reset]);

  // Manejar búsqueda en la tabla de usuarios
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
    resetPage();
  };

  const submit: SubmitHandler<z.infer<typeof CENTER_FORM_SCHEMA>> = async (data) => {
    try {
      await updateCenter(data);
      message.success('Centro actualizado exitosamente');
      navigate(location.state?.from || `/companies/${centerData?.id_company}?tab=centros`);
    } catch {
      message.error('No se pudo actualizar el centro');
    }
  };

  const handleDelete = async () => {
    modal.confirm({
      title: "¿Seguro que desea eliminar este centro?",
      content: "Esta acción no se puede deshacer.",
      okText: "Eliminar",
      okType: "danger",
      cancelText: "Cancelar",
      onOk: async () => {
        try {
          await deleteCenter();
          message.success('Centro eliminado exitosamente');
          navigate(location.state?.from || `/companies/${centerData?.id_company}?tab=centros`);
        } catch {
          modal.error({
            title: "Error al eliminar el centro",
            content: "No se pudo eliminar el centro. Inténtelo de nuevo.",
          });
        }
      },
    });
  };

  if (isCenterLoading || (centerData && isCompanyLoading)) return <div>Cargando...</div>;

  // Contenido de la pestaña "Datos del Centro"
  const centerDataTab = (
    <div>
      {companyData && (
        <div style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
          <label htmlFor="company_name_display" style={{ marginRight: 8, fontWeight: 500 }}>
            Empresa:
          </label>
          <Input 
            id="company_name_display" 
            value={companyData.corporate_name} 
            readOnly
            style={{ width: 400, flex: 1 }} 
          />
          <Button
            type="link"
            onClick={() => navigate(`/companies/${companyData.id_company}`)}
            style={{ width: 'auto', flex: 1 }}
          >
            Ver
          </Button>
        </div>
      )}
      <Form layout="vertical" onFinish={handleSubmit(submit)} style={{ marginTop: 16 }}>
        <Row gutter={[16, 0]}>
          <Col xs={24} sm={6}>
            <Form.Item label="ID centro" name="id_center"
              help={errors.id_center?.message}
              validateStatus={errors.id_center ? "error" : undefined}
            >
              <Controller name="id_center" control={control} render={({ field }) => <Input id="id_center" {...field} readOnly data-testid="center-id" />} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item label="Nombre del centro" name="center_name"
              help={errors.center_name?.message}
              validateStatus={errors.center_name ? "error" : undefined}
            >
              <Controller name="center_name" control={control} render={({ field }) => <Input id="center_name" autoComplete="organization" {...field} readOnly={!canEdit} data-testid="center-name" />} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={6}>
            <Form.Item label="Número de patronal" name="employer_number"
              help={errors.employer_number?.message}
              validateStatus={errors.employer_number ? "error" : undefined}
            >
              <Controller name="employer_number" control={control} render={({ field }) => <Input id="employer_number" autoComplete="off" {...field} readOnly={!canEdit} value={field.value ?? undefined} data-testid="employer-number" />} />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={[16, 0]}>
          <Col xs={24} sm={8}>
            <Form.Item label="Persona de contacto" name="contact_person"
              help={errors.contact_person?.message}
              validateStatus={errors.contact_person ? "error" : undefined}
            >
              <Controller name="contact_person" control={control} render={({ field }) => <Input id="contact_person" autoComplete="name" {...field} readOnly={!canEdit} value={field.value ?? undefined} data-testid="contact-person" />} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item label="Teléfono de contacto" name="contact_phone"
              help={errors.contact_phone?.message}
              validateStatus={errors.contact_phone ? "error" : undefined}
            >
              <Controller name="contact_phone" control={control} render={({ field }) => <Input id="contact_phone" autoComplete="tel" {...field} readOnly={!canEdit} value={field.value ?? undefined} data-testid="contact-phone" />} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item label="Email de contacto" name="contact_email"
              help={errors.contact_email?.message}
              validateStatus={errors.contact_email ? "error" : undefined}
            >
              <Controller name="contact_email" control={control} render={({ field }) => <Input id="contact_email" autoComplete="email" {...field} readOnly={!canEdit} value={field.value ?? undefined} data-testid="contact-email" />} />
            </Form.Item>
          </Col>
        </Row>
        <div className="form-actions">
          <Button type="default" onClick={() => navigate(-1)}>Cancelar</Button>
          <AuthzHide roles={[Role.ADMIN, Role.MANAGER]}>
          <Button type="primary" htmlType="submit" icon={<SaveOutlined />} data-testid="save-center">Guardar</Button>
          <Button type="primary" danger onClick={handleDelete} icon={<DeleteOutlined />}>Eliminar Centro</Button>
          </AuthzHide>
        </div>
      </Form>
    </div>
  );

  // Contenido de la pestaña "Usuarios"
  const usersToolbar = (
    <>
      <Input.Search
        placeholder="Buscar usuarios (nombre, apellido, email, DNI)"
        style={{ minWidth: 260, maxWidth: 400 }}
        value={searchText}
        onChange={handleSearch}
        loading={isUsersLoading}
        allowClear
      />
      <Checkbox
        checked={onlyMainCenter}
        onChange={(e) => { setOnlyMainCenter(e.target.checked); resetPage(); }}
      >
        Solo centro principal
      </Checkbox>
      <Checkbox
        checked={showInactive}
        onChange={(e) => { setShowInactive(e.target.checked); resetPage(); }}
      >
        Mostrar dados de baja
      </Checkbox>
    </>
  );

  const usersTab = (
    <ListPageLayout toolbar={usersToolbar}>
      {({ scrollY }) => (
        <DataTable<User>
          rowKey="id_user"
          loading={isUsersLoading}
          dataSource={usersResponse?.data || []}
          pagination={{ ...pagination, total: usersResponse?.total || 0 }}
          onChange={handleTableChange}
          scrollY={scrollY}
          getRowUrl={(record) => {
            const uid = Number(record.id_user);
            return Number.isFinite(uid) ? `/users/${uid}` : undefined;
          }}
          columns={[
            {
              title: 'DNI',
              dataIndex: 'dni',
              sorter: (a: User, b: User) => (a.dni ?? '').localeCompare(b.dni ?? ''),
              width: 120,
            },
            {
              title: 'Nombre',
              dataIndex: 'name',
              sorter: (a: User, b: User) => (a.name ?? '').localeCompare(b.name ?? ''),
              width: 150,
              render: (_, user: User) => <>{user.name}<BajaTag user={user} /></>,
            },
            {
              title: 'Apellidos',
              dataIndex: 'first_surname',
              sorter: (a: User, b: User) => (a.first_surname ?? '').localeCompare(b.first_surname ?? ''),
              width: 200,
              render: (_, user: User) => `${user.first_surname ?? ''} ${user.second_surname ?? ''}`.trim(),
            },
            {
              title: 'Email',
              dataIndex: 'email',
              sorter: (a: User, b: User) => (a.email ?? '').localeCompare(b.email ?? ''),
              width: 200,
            },
            {
              title: 'NSS',
              dataIndex: 'nss',
              sorter: (a: User, b: User) => (a.nss ?? '').localeCompare(b.nss ?? ''),
              width: 160,
            }
          ]}
        />
      )}
    </ListPageLayout>
  );

  return (
    <div>
      <RouteTabs
        items={[
          {
            key: "datos",
            label: "Datos del Centro",
            children: centerDataTab,
          },
          {
            key: "usuarios",
            label: "Usuarios",
            children: usersTab,
          },
        ]}
      />
    </div>
  );
}
