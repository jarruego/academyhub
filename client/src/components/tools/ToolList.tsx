import { Button, Card, List, Typography } from "antd";
import { ToolOutlined, DatabaseOutlined, FileTextOutlined, UserOutlined, SafetyCertificateOutlined, MailOutlined, CommentOutlined, SettingOutlined, MergeCellsOutlined, MedicineBoxOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";
import { AuthzHide } from "../permissions/authz-hide";
import { Role } from "../../hooks/api/auth/use-login.mutation";

interface Tool {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  linkTo: string;
}

interface ToolCategory {
  key: string;
  category: string;
  tools: Tool[];
}

export const toolCategories: ToolCategory[] = [
  {
    key: "importaciones",
    category: "Importaciones",
    tools: [
      {
        key: "moodle-import",
        label: "Importación de Moodle",
        description: "Gestiona la importación de cursos, grupos y usuarios desde Moodle.",
        icon: <ToolOutlined style={{ fontSize: 20 }} />,
        linkTo: "/tools/moodle-import",
      },
      {
        key: "data-cross-reference",
        label: "Cruce de datos BD - Moodle",
        description: "Compara y cruza datos de usuarios entre la base de datos local y Moodle.",
        icon: <DatabaseOutlined style={{ fontSize: 20 }} />,
        linkTo: "/tools/data-cross-reference",
      },
      {
        key: "sage-import",
        label: "Importación CSV SAGE",
        description: "Importa datos desde archivos CSV generados por SAGE.",
        icon: <FileTextOutlined style={{ fontSize: 20 }} />,
        linkTo: "/tools/import-sage",
      },
      {
        key: "import-inaem",
        label: "Importación INAEM",
        description: "Importa acciones, alumnos y preinscripciones del INAEM (3 ficheros opcionales).",
        icon: <FileTextOutlined style={{ fontSize: 20 }} />,
        linkTo: "/tools/import-inaem",
      },
    ],
  },
  {
    key: "gestion-acceso",
    category: "Gestión y acceso",
    tools: [
      {
        key: "user-management",
        label: "Gestión de usuarios",
        description: "Administra usuarios de la app y sus roles de acceso.",
        icon: <UserOutlined style={{ fontSize: 20 }} />,
        linkTo: "/tools/user-management",
      },
      {
        key: "audit-log",
        label: "Registro de auditoría",
        description: "Consulta quién realizó cada operación (altas, bajas, importaciones, cambios de rol…).",
        icon: <SafetyCertificateOutlined style={{ fontSize: 20 }} />,
        linkTo: "/tools/audit-log",
      },
    ],
  },
  {
    key: "correo",
    category: "Correo",
    tools: [
      {
        key: "smtp",
        label: "Configuración SMTP",
        description: "Configura el servidor de correo saliente (SMTP) de la organización.",
        icon: <SettingOutlined style={{ fontSize: 20 }} />,
        linkTo: "/organization/smtp",
      },
      {
        key: "email-log",
        label: "Registro de envíos de correo",
        description: "Consulta los correos enviados: quién, cuándo, destinatario, plantilla y estado.",
        icon: <MailOutlined style={{ fontSize: 20 }} />,
        linkTo: "/tools/email-log",
      },
    ],
  },
  {
    key: "herramientas",
    category: "Herramientas",
    tools: [
      {
        key: "forum-duplicator",
        label: "Duplicado de Foros",
        description: "Replica el tema de los foros de Moodle a todos los grupos (un tema por grupo), en nombre del tutor.",
        icon: <CommentOutlined style={{ fontSize: 20 }} />,
        linkTo: "/tools/forum-duplicator",
      },
      {
        key: "merge-duplicates",
        label: "Fusión de duplicados",
        description: "Detecta usuarios duplicados por NSS (caso NIE↔DNI) y fúsionalos en una sola ficha.",
        icon: <MergeCellsOutlined style={{ fontSize: 20 }} />,
        linkTo: "/tools/merge-duplicates",
      },
      {
        key: "data-sanitization",
        label: "Sanitización de datos",
        description: "Detecta teléfonos, emails, DNI/NIE y NSS inválidos; corrige los auto-corregibles o abre la ficha del usuario.",
        icon: <MedicineBoxOutlined style={{ fontSize: 20 }} />,
        linkTo: "/tools/user-sanitization",
      },
    ],
  },
];

interface ToolListProps {
  categoryKey?: string;
}

const ToolList = ({ categoryKey }: ToolListProps) => {
  const categories = categoryKey
    ? toolCategories.filter(c => c.key === categoryKey)
    : toolCategories;
  const cardTitle = categories.length === 1 ? categories[0].category : "Herramientas administrativas";

  return (
    <AuthzHide roles={[Role.ADMIN]}>
      <Card title={<span>{cardTitle}</span>} bordered style={{ maxWidth: 500, margin: "0 auto" }}>
        {categories.map((category, index) => (
          <div key={category.key} style={{ marginTop: index === 0 ? 0 : 24 }}>
            {categories.length > 1 && (
              <Typography.Title level={5} style={{ marginBottom: 8 }}>
                {category.category}
              </Typography.Title>
            )}
            <List
              itemLayout="horizontal"
              dataSource={category.tools}
              renderItem={tool => (
                <List.Item
                  actions={[
                    <Link to={tool.linkTo} key="open">
                      <Button type="primary">Abrir herramienta</Button>
                    </Link>,
                  ]}
                >
                  <List.Item.Meta
                    avatar={tool.icon}
                    title={tool.label}
                    description={tool.description}
                  />
                </List.Item>
              )}
            />
          </div>
        ))}
      </Card>
    </AuthzHide>
  );
};

export default ToolList;
