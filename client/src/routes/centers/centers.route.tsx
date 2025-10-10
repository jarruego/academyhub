import { useNavigate } from "react-router-dom";
import { Table, Input } from "antd";
import { useCentersQuery } from "../../hooks/api/centers/use-centers.query";
import { useEffect, useState } from "react";

export default function CentersRoute() {
  const navigate = useNavigate();
  const { data: centersData, isLoading: isCentersLoading } = useCentersQuery();
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    document.title = "Centros";
  }, []);

  const normalize = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
  };

  const normalizedSearch = normalize(searchText);

  const filteredCenters = centersData?.filter(center =>
    normalize(center.center_name ?? '').includes(normalizedSearch) ||
    normalize(center.employer_number ?? '').includes(normalizedSearch) ||
    normalize(center.contact_person ?? '').includes(normalizedSearch) ||
    normalize(center.contact_phone ?? '').includes(normalizedSearch) ||
    normalize(center.contact_email ?? '').includes(normalizedSearch)
  )?.slice().sort((a, b) => (a.center_name ?? '').localeCompare(b.center_name ?? ''));

  return (
    <div>
      <Input.Search
        id="centers-search"
        placeholder="Buscar centros"
        style={{ marginBottom: 16 }}
        value={searchText}
        onChange={handleSearch}
        aria-label="Buscar centros"
      />
      <Table
        rowKey="id_center"
        columns={[
          { title: 'ID', dataIndex: 'id_center', sorter: (a, b) => a.id_center - b.id_center },
          { title: 'Nombre del centro', dataIndex: 'center_name', sorter: (a, b) => (a.center_name ?? '').localeCompare(b.center_name ?? '') },
          { title: 'Número de patronal', dataIndex: 'employer_number', sorter: (a, b) => (a.employer_number ?? '').localeCompare(b.employer_number ?? '') },
          { title: 'Persona de contacto', dataIndex: 'contact_person', sorter: (a, b) => (a.contact_person ?? '').localeCompare(b.contact_person ?? '') },
          { title: 'Teléfono de contacto', dataIndex: 'contact_phone', sorter: (a, b) => (a.contact_phone ?? '').localeCompare(b.contact_phone ?? '') },
          { title: 'Email de contacto', dataIndex: 'contact_email', sorter: (a, b) => (a.contact_email ?? '').localeCompare(b.contact_email ?? '') },
          { title: 'Empresa', dataIndex: 'company_name', sorter: (a, b) => (a.company_name ?? '').localeCompare(b.company_name ?? '') },
        ]}
        dataSource={filteredCenters}
        loading={isCentersLoading}
        onRow={(record) => ({
          onDoubleClick: () => navigate(`/centers/${record.id_center}/edit`, { state: { from: '/centers' } }),
          style: { cursor: 'pointer' }
        })}
      />
    </div>
  );
}
