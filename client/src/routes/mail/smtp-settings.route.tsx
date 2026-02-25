
import { Tabs } from 'antd';
import { MailOutlined, FileTextOutlined } from '@ant-design/icons';
import MailTemplatesTab from '../../components/mail/MailTemplatesTab';
import MailConfigTab from '../../components/mail/MailConfigTab';


export default function CorreoPage() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
      <Tabs
        defaultActiveKey="plantillas"
        items={[
          {
            key: 'plantillas',
            label: <span><FileTextOutlined /> Plantillas</span>,
            children: <MailTemplatesTab />,
          },
          {
            key: 'config',
            label: <span><MailOutlined /> Configuración</span>,
            children: <MailConfigTab />,
          },
        ]}
      />
    </div>
  );
}
