import { Button, Table } from "antd";
import { useNavigate } from "react-router-dom";
import { useCompaniesQuery } from "../../hooks/api/companies/use-companies.query";
import { PlusOutlined } from "@ant-design/icons"; 
import { useEffect } from "react";
import { AuthzHide } from "../../components/permissions/authz-hide";
import { Role } from "../../hooks/api/auth/use-login.mutation";

export default function CompaniesRoute() {
  const { data: companiesData, isLoading: isCompaniesLoading } = useCompaniesQuery();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Empresas";
  }, []);

  return <div>
    <AuthzHide roles={[Role.ADMIN]}>
    <Button type="primary" onClick={() => navigate('/add-company')} icon={<PlusOutlined />}>Añadir Empresa</Button>
    </AuthzHide>
    <Table 
      rowKey="id_company" 
      columns={[
        {
          title: 'ID',
          dataIndex: 'id_company',
        },
        {
          title: 'Nombre',
          dataIndex: 'company_name',
        },
        {
          title: 'Razón Social',
          dataIndex: 'corporate_name',
        },
        {
          title: 'CIF',
          dataIndex: 'cif',
        }
      ]} 
      dataSource={companiesData} 
      loading={isCompaniesLoading}
      onRow={(record) => ({
        onDoubleClick: () => navigate(`/companies/${record.id_company}`),
        style: { cursor: 'pointer' }
      })}
    />
  </div>
}
