import { useMemo, useState } from "react";
import { App, Button, Card, Col, Row, Select, Statistic, Table } from "antd";
import { FilePdfOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { useCompaniesQuery } from "../../hooks/api/companies/use-companies.query";
import { useCentersQuery } from "../../hooks/api/centers/use-centers.query";
import { useCoursesQuery } from "../../hooks/api/courses/use-courses.query";
import { useCourseRequestReportQuery } from "../../hooks/api/course-requests/use-course-request-report.query";
import { useCourseRequestReportPdfMutation } from "../../hooks/api/course-requests/use-course-request-report-pdf.mutation";
import { CourseRequestReportRow } from "../../shared/types/course-request/course-request-report";

type ReportRow = CourseRequestReportRow & { companyRowSpan: number; courseRowSpan: number };

// Añade el nº de filas a fusionar (rowSpan) por empresa y por empresa+curso, para
// que la tabla se lea como una jerarquía Empresa > Curso > Centro sin repetir
// texto (las filas ya llegan ordenadas por empresa/curso/centro desde el backend).
function withRowSpans(rows: CourseRequestReportRow[]): ReportRow[] {
  const companyCounts = new Map<string, number>();
  const courseCounts = new Map<string, number>();
  for (const row of rows) {
    const companyKey = String(row.id_company ?? "none");
    const courseKey = `${companyKey}::${row.id_course}`;
    companyCounts.set(companyKey, (companyCounts.get(companyKey) ?? 0) + 1);
    courseCounts.set(courseKey, (courseCounts.get(courseKey) ?? 0) + 1);
  }
  const seenCompany = new Set<string>();
  const seenCourse = new Set<string>();
  return rows.map((row) => {
    const companyKey = String(row.id_company ?? "none");
    const courseKey = `${companyKey}::${row.id_course}`;
    const companyRowSpan = seenCompany.has(companyKey) ? 0 : companyCounts.get(companyKey)!;
    const courseRowSpan = seenCourse.has(courseKey) ? 0 : courseCounts.get(courseKey)!;
    seenCompany.add(companyKey);
    seenCourse.add(courseKey);
    return { ...row, companyRowSpan, courseRowSpan };
  });
}

export function CourseRequestReportTab() {
  const { message: messageApi } = App.useApp();
  const [idCompanies, setIdCompanies] = useState<number[]>([]);
  const [idCenter, setIdCenter] = useState<number | undefined>();
  const [idCourse, setIdCourse] = useState<number | undefined>();

  const { data: companies } = useCompaniesQuery();
  const { data: centers } = useCentersQuery();
  const { data: courses } = useCoursesQuery();
  const filters = {
    id_company: idCompanies.length ? idCompanies : undefined,
    id_center: idCenter,
    id_course: idCourse,
  };
  const { data: rows, isLoading } = useCourseRequestReportQuery(filters);
  const pdfMutation = useCourseRequestReportPdfMutation();

  const centerOptions = useMemo(
    () => centers?.filter((c) => !idCompanies.length || idCompanies.includes(c.id_company)),
    [centers, idCompanies],
  );

  const tableRows = useMemo(() => withRowSpans(rows ?? []), [rows]);

  const totals = useMemo(() => {
    const companiesSet = new Set<string>();
    const coursesSet = new Set<string>();
    const centersSet = new Set<string>();
    let students = 0;
    let requests = 0;
    for (const row of rows ?? []) {
      companiesSet.add(String(row.id_company ?? "none"));
      coursesSet.add(String(row.id_course));
      centersSet.add(String(row.id_center ?? "none"));
      students += row.student_count;
      requests += row.request_count;
    }
    return { companies: companiesSet.size, courses: coursesSet.size, centers: centersSet.size, students, requests };
  }, [rows]);

  const handleExportPdf = async () => {
    try {
      await pdfMutation.mutateAsync(filters);
    } catch {
      messageApi.error("No se pudo generar el PDF");
    }
  };

  const columns: ColumnsType<ReportRow> = [
    {
      title: "Empresa",
      dataIndex: "company_name",
      render: (v: string | null, record) => ({
        children: v || "Sin empresa",
        props: { rowSpan: record.companyRowSpan },
      }),
    },
    {
      title: "Curso",
      dataIndex: "course_name",
      render: (v: string, record) => ({
        children: v,
        props: { rowSpan: record.courseRowSpan },
      }),
    },
    { title: "Centro", dataIndex: "center_name", render: (v: string | null) => v || "Sin centro" },
    { title: "Peticiones", dataIndex: "request_count", width: 110 },
    { title: "Alumnos", dataIndex: "student_count", width: 100 },
  ];

  return (
    <Card>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Select
            mode="multiple"
            allowClear
            showSearch
            maxTagCount="responsive"
            placeholder="Filtrar por empresa (varias a la vez)"
            style={{ width: "100%" }}
            value={idCompanies}
            onChange={(values) => { setIdCompanies(values); setIdCenter(undefined); }}
            optionFilterProp="label"
            options={companies?.map((c) => ({ value: c.id_company, label: c.company_name }))}
          />
        </Col>
        <Col xs={24} sm={8}>
          <Select
            allowClear
            showSearch
            placeholder="Filtrar por centro"
            style={{ width: "100%" }}
            value={idCenter}
            onChange={setIdCenter}
            optionFilterProp="label"
            options={centerOptions?.map((c) => ({ value: c.id_center, label: c.center_name }))}
          />
        </Col>
        <Col xs={24} sm={8}>
          <Select
            allowClear
            showSearch
            placeholder="Filtrar por curso"
            style={{ width: "100%" }}
            value={idCourse}
            onChange={setIdCourse}
            optionFilterProp="label"
            options={courses?.map((c) => ({ value: c.id_course, label: c.course_name }))}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={8} md={4}><Statistic title="Empresas" value={totals.companies} /></Col>
        <Col xs={12} sm={8} md={4}><Statistic title="Cursos" value={totals.courses} /></Col>
        <Col xs={12} sm={8} md={4}><Statistic title="Centros" value={totals.centers} /></Col>
        <Col xs={12} sm={8} md={4}><Statistic title="Alumnos" value={totals.students} /></Col>
        <Col xs={12} sm={8} md={4}><Statistic title="Peticiones" value={totals.requests} /></Col>
      </Row>

      <div style={{ marginBottom: 12 }}>
        <Button icon={<FilePdfOutlined />} loading={pdfMutation.isPending} onClick={handleExportPdf}>
          Exportar a PDF
        </Button>
      </div>

      <Table<ReportRow>
        size="small"
        bordered
        rowKey={(r) => `${r.id_company ?? "none"}-${r.id_course}-${r.id_center ?? "none"}`}
        columns={columns}
        dataSource={tableRows}
        loading={isLoading}
        pagination={false}
      />
    </Card>
  );
}
