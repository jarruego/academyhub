import { Button, Table } from "antd";
import { useNavigate } from "react-router-dom";
import { useCompaniesQuery } from "../hooks/api/companies/use-companies.query";
import { PlusOutlined, ReloadOutlined } from "@ant-design/icons"; // Importar los iconos
import { useEffect } from "react";

export default function CompaniesRoute() {
  const { data: companiesData, isLoading: isCompaniesLoading, isFetching: isCompaniesRefetching, refetch: refetchCompanies } = useCompaniesQuery();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Empresas";
  }, []);

  return <div>
    <Button type="primary" onClick={() => navigate('/add-company')} icon={<PlusOutlined />}>Añadir Empresa</Button>
    <Button onClick={() => refetchCompanies()} loading={isCompaniesRefetching} icon={<ReloadOutlined />}>Refrescar</Button>
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
