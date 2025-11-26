import React from "react";
import { Button, Select, message, Table, Modal, Popconfirm } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import { useCentersQuery } from "../../hooks/api/centers/use-centers.query";
import { useAddUserToCenterMutation } from "../../hooks/api/centers/use-add-user-to-center.mutation";
import { useUserCentersQuery } from "../../hooks/api/users/use-user-centers.query";
import { useCompaniesQuery } from "../../hooks/api/companies/use-companies.query";
import { useDeleteUsersFromCentersMutation } from "../../hooks/api/centers/use-delete-users-from-centers.mutation";
import { useUpdateUserMainCenterMutation } from '../../hooks/api/centers/use-update-user-main-center.mutation';
import type { UserCenter } from '../../shared/types/center/user-center';
import { AuthzHide } from "../../components/permissions/authz-hide";
import { Role } from "../../hooks/api/auth/use-login.mutation";

interface AddUserToCenterSectionProps {
  id_user: number;
}

export function AddUserToCenterSection({ id_user }: AddUserToCenterSectionProps) {
  const { data: userCenters, isLoading: isCentersLoading, refetch: refetchUserCenters } = useUserCentersQuery(id_user);
  const { data: companies, isLoading: isCompaniesLoading } = useCompaniesQuery();
  const [selectedCompany, setSelectedCompany] = React.useState<number | undefined>();
  const { data: centers, isLoading: isCentersLoadingAll } = useCentersQuery(selectedCompany ? String(selectedCompany) : undefined);
  const [selectedCenter, setSelectedCenter] = React.useState<number | undefined>();
  const { mutateAsync: addUserToCenter, status } = useAddUserToCenterMutation();
  const { mutateAsync: deleteUsersFromCenters, status: deleteStatus } = useDeleteUsersFromCentersMutation();
  const updateUserMainCenterMutation = useUpdateUserMainCenterMutation();
  const [modal, contextHolder] = Modal.useModal();
  const [messageApi, messageContextHolder] = message.useMessage();

  const handleAdd = async () => {
    if (!id_user || !selectedCenter) return;
    try {
      await addUserToCenter({ id_user: Number(id_user), id_center: selectedCenter });
      messageApi.success("Usuario añadido al centro correctamente");
      setSelectedCenter(undefined);
      refetchUserCenters();
    } catch {
      messageApi.error("No se pudo añadir el usuario al centro");
    }
  };

  // Limpiar centro seleccionado si se cambia de empresa
  React.useEffect(() => {
    setSelectedCenter(undefined);
  }, [selectedCompany]);

  return (
    <>
  {contextHolder}
  {messageContextHolder}
      <Table
        dataSource={((userCenters as UserCenter[] || [])
          .slice()
          .sort((a, b) => {
            // Ordena por Fecha de alta (start_date) de mayor a menor
            const ta = a.start_date ? new Date(a.start_date).getTime() : 0;
            const tb = b.start_date ? new Date(b.start_date).getTime() : 0;
            if (tb !== ta) return tb - ta; // descending
            // Fallback: ordena por empresa y luego por nombre de centro
            const companyA = (a.company_name || '').toLowerCase();
            const companyB = (b.company_name || '').toLowerCase();
            if (companyA < companyB) return -1;
            if (companyA > companyB) return 1;
            const centerA = (a.center_name || '').toLowerCase();
            const centerB = (b.center_name || '').toLowerCase();
            return centerA.localeCompare(centerB);
          })
        )}
        loading={isCentersLoading}
        rowKey="id_center"
        pagination={false}
        columns={[
          { title: "ID", dataIndex: "id_center", key: "id_center" },
          { title: "Nombre", dataIndex: "center_name", key: "center_name" },
          { title: "Nº Patronal", dataIndex: "employer_number", key: "employer_number" },
          { title: "Empresa", dataIndex: "company_name", key: "company_name" },
          { 
            title: "Fecha de alta", 
            dataIndex: "start_date", 
            key: "start_date",
            render: (date: string | Date | null) => date ? new Date(date).toLocaleDateString('es-ES') : '-'
          },
          { 
            title: "Fecha de baja", 
            dataIndex: "end_date", 
            key: "end_date",
            render: (date: string | Date | null) => date ? new Date(date).toLocaleDateString('es-ES') : '-'
          },
          {
            title: "",
            key: "actions",
            render: (_: unknown, record: UserCenter) => (
              <>
                {record.is_main_center ? (
                  <Button
                    type="primary"
                    size="small"
                    style={{ marginRight: 8, minWidth: 110, cursor: 'info', pointerEvents: 'none', opacity: 0.85 }}                    
                  >
                    PRINCIPAL
                  </Button>
                ) : (
                  <AuthzHide roles={[Role.ADMIN]}>
                    <Popconfirm
                      title="Marcar este centro como principal?"
                      onConfirm={async () => {
                        try {
                          await updateUserMainCenterMutation.mutateAsync({ userId: Number(id_user), centerId: record.id_center });
                          messageApi.success('Centro principal actualizado');
                          refetchUserCenters();
                        } catch (err) {
                          messageApi.error('Error actualizando centro principal');
                        }
                      }}
                      okText="Sí"
                      cancelText="No"
                    >
                      <Button
                        size="small"
                        style={{ marginRight: 8, minWidth: 110 }}
                        loading={updateUserMainCenterMutation.isPending}
                      >
                        Hacer principal
                      </Button>
                    </Popconfirm>
                  </AuthzHide>
                )}
                <AuthzHide roles={[Role.ADMIN]}>
                  <Button
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    loading={deleteStatus === 'pending'}
                    onClick={async () => {
                      modal.confirm({
                        title: "¿Seguro que desea eliminar este centro del usuario?",
                        content: "Esta acción no se puede deshacer.",
                        okText: "Eliminar",
                        okType: "danger",
                        cancelText: "Cancelar",
                        onOk: async () => {
                          try {
                            await deleteUsersFromCenters([{ id_center: record.id_center, id_user: Number(id_user) }]);
                            message.success('Registro eliminado correctamente');
                            refetchUserCenters();
                          } catch {
                            message.error('Error al eliminar el registro');
                          }
                        },
                      });
                    }}
                  >
                    Eliminar
                  </Button>
                </AuthzHide>
              </>
            ),
          },
        ]}
        style={{ marginTop: 32 }}
      />
      <AuthzHide roles={[Role.ADMIN]}>
        <div style={{ display: 'flex', gap: 8, marginTop: 24, alignItems: 'center' }}>
          <Select
            showSearch
            style={{ minWidth: 200 }}
            placeholder="Selecciona una empresa"
            loading={isCompaniesLoading}
            value={selectedCompany}
            onChange={setSelectedCompany}
            optionLabelProp="label"
            optionFilterProp="children"
            filterOption={(input, option) =>
              (option?.children?.toString() ?? '').toLowerCase().includes(input.toLowerCase())
            }
          >
            {companies?.map(company => (
              <Select.Option key={company.id_company} value={company.id_company} label={`${company.company_name} (${company.cif})`}>
                {company.company_name} ({company.cif})
              </Select.Option>
            ))}
          </Select>
          <Select
            showSearch
            style={{ minWidth: 250 }}
            placeholder="Selecciona un centro"
            loading={isCentersLoadingAll}
            value={selectedCenter}
            onChange={setSelectedCenter}
            optionLabelProp="label"
            optionFilterProp="children"
            filterOption={(input, option) =>
              (option?.children?.toString() ?? '').toLowerCase().includes(input.toLowerCase())
            }
            disabled={!selectedCompany}
          >
            {centers
              ?.filter(center =>
                !(userCenters || []).some(uc => uc.id_center === center.id_center)
              )
              .map(center => (
                <Select.Option key={center.id_center} value={center.id_center} label={`${center.center_name} (${center.employer_number || 'Sin nº patronal'})`}>
                  {center.center_name} ({center.employer_number || 'Sin nº patronal'})
                </Select.Option>
              ))}
          </Select>
          <Button
            type="primary"
            onClick={handleAdd}
            disabled={!selectedCenter || status === 'pending'}
            loading={status === 'pending'}
          >
            Añadir al centro
          </Button>
        </div>
      </AuthzHide>
    </>
  );
}
