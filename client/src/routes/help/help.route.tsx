import { useMemo, useState } from "react";
import { Collapse, Typography, Image, Button, Space, Input, Empty } from "antd";
import { PlayCircleOutlined } from "@ant-design/icons";
import { PageHeader } from "../../components/common/PageHeader";
import { useTour } from "../../providers/tour/tour.context";
import { useIsMobile } from "../../hooks/use-is-mobile";
import { normalizeLoose, matchesLoose } from "../../utils/normalize-search";
import { tutorManualSections } from "./tutor-manual.content";

export default function HelpRoute() {
  const { startTour } = useTour();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");

  const filteredSections = useMemo(() => {
    const query = normalizeLoose(search);
    if (!query) return tutorManualSections;
    return tutorManualSections.filter((section) =>
      matchesLoose(query, [section.title, ...section.paragraphs, ...(section.bullets ?? [])]),
    );
  }, [search]);

  return (
    <div>
      <PageHeader
        title="Ayuda"
        subtitle="Manual de uso para los perfiles Tutor y Consulta"
        extra={
          !isMobile && (
            <Button type="primary" icon={<PlayCircleOutlined />} onClick={startTour}>
              Iniciar tour guiado
            </Button>
          )
        }
      />
      {isMobile && (
        <Typography.Paragraph type="secondary">
          El tour guiado interactivo solo está disponible en modo escritorio. Aquí abajo tienes el manual completo.
        </Typography.Paragraph>
      )}
      <Input.Search
        placeholder="Buscar en el manual (p. ej. informes, correo, curso...)"
        allowClear
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ maxWidth: 480, marginBottom: 16 }}
      />
      {filteredSections.length === 0 ? (
        <Empty description="No se han encontrado resultados" />
      ) : (
        <Collapse
          accordion
          defaultActiveKey={tutorManualSections[0].key}
          items={filteredSections.map((section) => ({
            key: section.key,
            label: section.title,
            children: (
              <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                {section.paragraphs.map((paragraph, index) => (
                  <Typography.Paragraph key={index} style={{ marginBottom: 0 }}>
                    {paragraph}
                  </Typography.Paragraph>
                ))}
                {section.bullets && (
                  <ul style={{ marginTop: 0 }}>
                    {section.bullets.map((bullet, index) => (
                      <li key={index}>{bullet}</li>
                    ))}
                  </ul>
                )}
                {section.images?.map((image, index) => (
                  <Image
                    key={index}
                    src={image.src}
                    alt={image.alt}
                    style={{ maxWidth: "100%", border: "1px solid #d9d9d9", borderRadius: 4 }}
                  />
                ))}
              </Space>
            ),
          }))}
        />
      )}
    </div>
  );
}
