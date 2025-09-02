import { Button, Card, List, Typography } from "antd";
import { ToolOutlined } from "@ant-design/icons";
import { useReimportMoodleMutation } from "../../hooks/api/moodle/use-reimport-moodle.mutation";
import { AuthzHide } from "../permissions/authz-hide";
import { Role } from "../../hooks/api/auth/use-login.mutation";

const tools = [
  {
    key: "reimport-moodle",
    label: "Reimportar datos de Moodle",
    description: "Sincroniza manualmente los datos desde la plataforma Moodle.",
    icon: <ToolOutlined style={{ fontSize: 20 }} />,
    renderAction: (reimport: () => void, isReimporting: boolean) => (
      <Button onClick={reimport} loading={isReimporting} type="primary">
        Reimportar
      </Button>
    ),
    adminOnly: true,
  },
  // Aquí se pueden añadir más herramientas en el futuro
];

const ToolList = () => {
  const { mutateAsync: reimport, isPending: isReimporting } = useReimportMoodleMutation();
  return (
    <Card title={<span>Herramientas administrativas</span>} bordered style={{ maxWidth: 500, margin: "0 auto" }}>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 24 }}>
        Accede a utilidades administrativas. Pronto habrá más herramientas disponibles.
      </Typography.Paragraph>
      <List
        itemLayout="horizontal"
        dataSource={tools}
        renderItem={tool => (
          tool.adminOnly ? (
            <AuthzHide roles={[Role.ADMIN]}>
              <List.Item>
                <List.Item.Meta
                  avatar={tool.icon}
                  title={tool.label}
                  description={tool.description}
                />
                {tool.renderAction(reimport, isReimporting)}
              </List.Item>
            </AuthzHide>
          ) : (
            <List.Item>
              <List.Item.Meta
                avatar={tool.icon}
                title={tool.label}
                description={tool.description}
              />
              {tool.renderAction(reimport, isReimporting)}
            </List.Item>
          )
        )}
      />
    </Card>
  );
};

export default ToolList;
