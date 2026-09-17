import { Link } from "react-router-dom";
import { Result, Table, Tag } from "antd";
import { useConsultingCentroEngagementsQuery } from "../../hooks/api/consulting-centro/use-consulting-centro-engagements.query";

export default function ConsultingCentroEngagementsRoute() {
  const { data, isLoading, isError } = useConsultingCentroEngagementsQuery();

  if (isError) {
    return <Result status="403" title="Enlace no válido" subTitle="Este enlace no funciona — puede haber sido revocado o regenerado. Pide uno nuevo." />;
  }

  return (
    <div>
      <p>Elige el ejercicio de consultoría en el que quieres trabajar.</p>
      <Table
        rowKey="id_annual_engagement"
        loading={isLoading}
        dataSource={data}
        pagination={false}
        locale={{ emptyText: 'Este centro no participa todavía en ninguna consultoría.' }}
        columns={[
          { title: 'Cliente', dataIndex: 'client_name' },
          { title: 'Año', dataIndex: 'year' },
          {
            title: 'Estado',
            dataIndex: 'status',
            render: (status: string) => <Tag color={status === 'OPEN' ? 'green' : 'default'}>{status === 'OPEN' ? 'Abierta' : 'Cerrada'}</Tag>,
          },
          {
            title: '',
            key: 'actions',
            render: (_, record) => <Link to={`/consultoria-centro/app/${record.id_annual_engagement}`}>Entrar</Link>,
          },
        ]}
      />
    </div>
  );
}
