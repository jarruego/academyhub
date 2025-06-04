import React from "react";
import { Button, Select, message, Table, Modal } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import { useCentersQuery } from "../../hooks/api/centers/use-centers.query";
import { useAddUserToCenterMutation } from "../../hooks/api/centers/use-add-user-to-center.mutation";
import { useUserCentersQuery } from "../../hooks/api/users/use-user-centers.query";
import { useCompaniesQuery } from "../../hooks/api/companies/use-companies.query";
import { useDeleteUsersFromCentersMutation } from "../../hooks/api/centers/use-delete-users-from-centers.mutation";

interface AddUserToCenterSectionProps {
  id_user?: string;
}

export function AddUserToCenterSection({ id_user }: AddUserToCenterSectionProps) {
  const { data: userCenters, isLoading: isCentersLoading, refetch: refetchUserCenters } = useUserCentersQuery(id_user || "");
  const { data: companies, isLoading: isCompaniesLoading } = useCompaniesQuery();
  const [selectedCompany, setSelectedCompany] = React.useState<number | undefined>();
  const { data: centers, isLoading: isCentersLoadingAll } = useCentersQuery(selectedCompany ? String(selectedCompany) : undefined);
  const [selectedCenter, setSelectedCenter] = React.useState<number | undefined>();
  const { mutateAsync: addUserToCenter, status } = useAddUserToCenterMutation();
  const { mutateAsync: deleteUsersFromCenters, status: deleteStatus } = useDeleteUsersFromCentersMutation();
  const [modal, contextHolder] = Modal.useModal();

  const handleAdd = async () => {
    if (!id_user || !selectedCenter) return;
    try {
      await addUserToCenter({ id_user: Number(id_user), id_center: selectedCenter });
      message.success("Usuario añadido al centro correctamente");
      setSelectedCenter(undefined);
      refetchUserCenters();
    } catch {
      message.error("No se pudo añadir el usuario al centro");
    }
  };

  // Limpiar centro seleccionado si se cambia de empresa
  React.useEffect(() => {
    setSelectedCenter(undefined);
  }, [selectedCompany]);

  return (
    <>
      {contextHolder}
      <Table
        dataSource={userCenters || []}
        loading={isCentersLoading}
        rowKey="id_center"
        pagination={false}
        columns={[
          { title: "ID", dataIndex: "id_center", key: "id_center" },
          { title: "Nombre", dataIndex: "center_name", key: "center_name" },
          { title: "Nº Patronal", dataIndex: "employer_number", key: "employer_number" },
          { title: "Empresa", dataIndex: "company_name", key: "company_name" },
          {
            title: "",
            key: "actions",
            render: (_, record) => (
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
            ),
          },
        ]}
        style={{ marginTop: 32 }}
      />
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
    </>
  );
}
