import { useNavigate } from "react-router-dom";
import { Table } from "antd";
import { useCentersQuery } from "../../hooks/api/centers/use-centers.query";
import { useEffect } from "react";

export default function CentersRoute() {
  const navigate = useNavigate();
  const { data: centersData, isLoading: isCentersLoading } = useCentersQuery();

  useEffect(() => {
    document.title = "Centros";
  }, []);
  
  return (
    <Table
      rowKey="id_center"
      columns={[
        { title: 'ID', dataIndex: 'id_center' },
        { title: 'Nombre del centro', dataIndex: 'center_name' },
        { title: 'Número de patronal', dataIndex: 'employer_number' },
        { title: 'Persona de contacto', dataIndex: 'contact_person' },
        { title: 'Teléfono de contacto', dataIndex: 'contact_phone' },
        { title: 'Email de contacto', dataIndex: 'contact_email' },
        { title: 'Empresa', dataIndex: 'company_name' }, 
      ]}
      dataSource={centersData}
      loading={isCentersLoading}
      onRow={(record) => ({
        onDoubleClick: () => navigate(`/centers/${record.id_center}/edit`, { state: { from: '/centers' } }),
        style: { cursor: 'pointer' }
      })}
    />
  );
}
