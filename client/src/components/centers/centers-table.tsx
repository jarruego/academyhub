import { useNavigate } from "react-router-dom";
import { Table, Input, Select, Radio, Space } from "antd";
import { useMemo, useState } from "react";
import { Center } from "../../shared/types/center/center";

type MainCenterFilter = "all" | "main" | "not-main";

interface CentersTableProps {
  centers?: Center[];
  loading?: boolean;
  /** Si está limitado a una empresa, oculta el filtro y la columna de empresa. */
  scopedToCompany?: boolean;
  /** Gesto de fila para navegar al detalle (click simple o doble). */
  rowTrigger?: "click" | "doubleClick";
  /** Estado pasado a navigate al abrir un centro (p.ej. { from: '/centers' }). */
  navigateState?: unknown;
  /** Contenido extra para la barra de herramientas (p.ej. botón "Añadir Centro"). */
  toolbarExtra?: React.ReactNode;
}

const normalize = (str: string) => str.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function CentersTable({
  centers,
  loading,
  scopedToCompany = false,
  rowTrigger = "click",
  navigateState,
  toolbarExtra,
}: CentersTableProps) {
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState("");
  const [companyFilter, setCompanyFilter] = useState<number[]>([]);
  const [mainCenterFilter, setMainCenterFilter] = useState<MainCenterFilter>("all");

  const normalizedSearch = normalize(searchText);

  // Opciones de empresa para el multiselect, derivadas de los centros cargados
  const companyOptions = useMemo(() => {
    const map = new Map<number, string>();
    centers?.forEach((center) => {
      if (center.id_company != null) {
        map.set(center.id_company, center.company_name ?? `Empresa ${center.id_company}`);
      }
    });
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [centers]);

  const filteredCenters = centers?.filter(center => {
    const matchesSearch =
      normalize(center.center_name ?? '').includes(normalizedSearch) ||
      normalize(center.employer_number ?? '').includes(normalizedSearch) ||
      normalize(center.contact_person ?? '').includes(normalizedSearch) ||
      normalize(center.contact_phone ?? '').includes(normalizedSearch) ||
      normalize(center.contact_email ?? '').includes(normalizedSearch);

    const matchesCompany = scopedToCompany || companyFilter.length === 0 || companyFilter.includes(center.id_company);

    const isMain = (center.main_user_count ?? 0) > 0;
    const matchesMain =
      mainCenterFilter === "all" ||
      (mainCenterFilter === "main" && isMain) ||
      (mainCenterFilter === "not-main" && !isMain);

    return matchesSearch && matchesCompany && matchesMain;
  })?.slice().sort((a, b) => (a.center_name ?? '').localeCompare(b.center_name ?? ''));

  const openCenter = (record: Center) =>
    navigate(`/centers/${record.id_center}/edit`, navigateState ? { state: navigateState } : undefined);

  return (
    <div>
      <Space wrap style={{ marginBottom: 16, width: '100%' }}>
        <Input.Search
          id="centers-search"
          placeholder="Buscar centros"
          style={{ width: 260 }}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          aria-label="Buscar centros"
        />
        {!scopedToCompany && (
          <Select
            id="centers-company-filter"
            mode="multiple"
            allowClear
            placeholder="Filtrar por empresa"
            style={{ minWidth: 260 }}
            value={companyFilter}
            onChange={setCompanyFilter}
            options={companyOptions}
            optionFilterProp="label"
            aria-label="Filtrar por empresa"
            maxTagCount="responsive"
          />
        )}
        <Radio.Group
          value={mainCenterFilter}
          onChange={(e) => setMainCenterFilter(e.target.value)}
          optionType="button"
          buttonStyle="solid"
        >
          <Radio.Button value="all">Todos</Radio.Button>
          <Radio.Button value="main">Principales</Radio.Button>
          <Radio.Button value="not-main">No principales</Radio.Button>
        </Radio.Group>
        {toolbarExtra}
      </Space>
      <Table
        rowKey="id_center"
        columns={[
          { title: 'ID', dataIndex: 'id_center', sorter: (a, b) => a.id_center - b.id_center },
          { title: 'Nombre del centro', dataIndex: 'center_name', sorter: (a, b) => (a.center_name ?? '').localeCompare(b.center_name ?? '') },
          { title: 'Número de patronal', dataIndex: 'employer_number', sorter: (a, b) => (a.employer_number ?? '').localeCompare(b.employer_number ?? '') },
          { title: 'Persona de contacto', dataIndex: 'contact_person', sorter: (a, b) => (a.contact_person ?? '').localeCompare(b.contact_person ?? '') },
          { title: 'Teléfono de contacto', dataIndex: 'contact_phone', sorter: (a, b) => (a.contact_phone ?? '').localeCompare(b.contact_phone ?? '') },
          { title: 'Email de contacto', dataIndex: 'contact_email', sorter: (a, b) => (a.contact_email ?? '').localeCompare(b.contact_email ?? '') },
          ...(scopedToCompany ? [] : [{ title: 'Empresa', dataIndex: 'company_name', sorter: (a: Center, b: Center) => (a.company_name ?? '').localeCompare(b.company_name ?? '') }]),
          { title: 'Usuarios asociados', dataIndex: 'user_count', align: 'right' as const, sorter: (a, b) => (a.user_count ?? 0) - (b.user_count ?? 0), render: (value) => value ?? 0 },
          { title: 'Usuarios (principal)', dataIndex: 'main_user_count', align: 'right' as const, sorter: (a, b) => (a.main_user_count ?? 0) - (b.main_user_count ?? 0), render: (value) => value ?? 0 },
        ]}
        dataSource={filteredCenters}
        loading={loading}
        onRow={(record) => ({
          ...(rowTrigger === "doubleClick"
            ? { onDoubleClick: () => openCenter(record) }
            : { onClick: () => openCenter(record) }),
          style: { cursor: 'pointer' }
        })}
      />
    </div>
  );
}
