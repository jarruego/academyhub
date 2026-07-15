import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import HomeRoute from './routes/home.route';
import UsersRoute from './routes/users/users.route';
import GroupsRoute from './routes/groups/groups.route';
import CoursesRoute from './routes/courses/courses.route';
import CourseDetailRoute from './routes/courses/course-detail.route';
import CreateUserRoute from './routes/users/create-user.route';
import CreateCourseRoute from './routes/courses/create-course.route';
import UserDetailRoute from './routes/users/user-detail.route';
import CreateGroupRoute from './routes/groups/create-group.route';
import EditGroupRoute from './routes/groups/group-detail.route';
import CompaniesRoute from './routes/companies/companies.route';
import CreateCompanyRoute from './routes/companies/create-company.route';
import CompanyDetailRoute from './routes/companies/company-detail.route';
import CreateCenterRoute from './routes/centers/create-center.route';
import EditCenterRoute from './routes/centers/center-detail.route';
import CentersRoute from './routes/centers/centers.route';
import { Layout, Menu, Button, Drawer, Grid } from 'antd';
import type { MenuProps } from 'antd';
import { useAuthInfo } from './providers/auth/auth.context';
import ToolsRoute from './routes/tools/tools.route';
import ToolList from './components/tools/ToolList';
import DataCrossReferenceRoute from './routes/tools/data-cross-reference.route';
import MoodleImportRoute from './routes/tools/moodle-import.route';
import SageImportRoute from './routes/tools/import-sage.route';
import InaemImportRoute from './routes/tools/import-inaem.route';
import AuditLogRoute from './routes/tools/audit-log.route';
import EmailLogRoute from './routes/tools/email-log.route';
import ForumDuplicatorRoute from './routes/tools/forum-duplicator.route';
import MergeDuplicatesRoute from './routes/tools/merge-duplicates.route';
import UserSanitizationRoute from './routes/tools/user-sanitization.route';
import BackupsRoute from './routes/tools/backups.route';
import UserManagementRoute from './routes/auth-users/auth-user-management.route';
import ReportsRoute from './routes/reports/reports.route';
import OrganizationSettingsPage from './routes/organization/OrganizationSettingsPage';
import SmtpSettingsPage from './routes/mail/smtp-settings.route';
import { useRole } from './utils/permissions/use-role';
import { Role } from './hooks/api/auth/use-login.mutation';
import {
  HomeOutlined,
  UserOutlined,
  BookOutlined,
  PieChartOutlined,
  ApartmentOutlined,
  BankOutlined,
  SettingOutlined,
  ToolOutlined,
  TeamOutlined,
  MailOutlined,
  MenuOutlined,
  FileTextOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';

const { Sider, Content, Header } = Layout;

const SIDER_BG = '#001529';

interface SidebarProps {
  isMobile: boolean;
  drawerOpen: boolean;
  onClose: () => void;
}

const Sidebar = ({ isMobile, drawerOpen, onClose }: SidebarProps) => {
  const { logout } = useAuthInfo();
  const role = useRole();

  type MenuItem = NonNullable<MenuProps['items']>[number];

  // onClose is called on every leaf Link click so the drawer closes on navigation.
  // On desktop onClose is a no-op.
  const menuItems: NonNullable<MenuProps['items']> = [
    { key: '/', icon: <HomeOutlined />, label: <Link to="/" onClick={onClose}>Home</Link> },
    { key: '/users', icon: <UserOutlined />, label: <Link to="/users" onClick={onClose}>Usuarios</Link> },
    { key: '/groups', icon: <TeamOutlined />, label: <Link to="/groups" onClick={onClose}>Grupos</Link> },
    { key: '/courses', icon: <BookOutlined />, label: <Link to="/courses" onClick={onClose}>Cursos</Link> },
    { key: '/companies', icon: <BankOutlined />, label: <Link to="/companies" onClick={onClose}>Empresas</Link> },
    { key: '/centers', icon: <ApartmentOutlined />, label: <Link to="/centers" onClick={onClose}>Centros</Link> },
    ...(role?.toLowerCase() === Role.ADMIN || role?.toLowerCase() === Role.MANAGER || role?.toLowerCase() === Role.VIEWER
      ? [{ key: '/reports', icon: <PieChartOutlined />, label: <Link to="/reports" onClick={onClose}>Informes</Link> }]
      : []),
  ];

  if (role?.toLowerCase() === Role.ADMIN) {
    const adminChildren: MenuItem[] = [
      { key: '/organization', icon: <SettingOutlined />, label: <Link to="/organization" onClick={onClose}>Organización</Link> },
      { key: '/tools/importaciones', icon: <FileTextOutlined />, label: <Link to="/tools/importaciones" onClick={onClose}>Importaciones</Link> },
      { key: '/tools/gestion-acceso', icon: <SafetyCertificateOutlined />, label: <Link to="/tools/gestion-acceso" onClick={onClose}>Gestión y acceso</Link> },
      { key: '/tools/correo', icon: <MailOutlined />, label: <Link to="/tools/correo" onClick={onClose}>Correo</Link> },
      { key: '/tools/herramientas', icon: <ToolOutlined />, label: <Link to="/tools/herramientas" onClick={onClose}>Herramientas</Link> },
    ];
    menuItems.push({ key: 'administracion', icon: <SettingOutlined />, label: <span>Administración</span>, children: adminChildren });
  }

  const menuContent = (
    <>
      <Menu theme="dark" mode="inline" items={menuItems} />
      <Button onClick={logout} style={{ margin: '16px' }}>Cerrar sesión</Button>
    </>
  );

  if (isMobile) {
    return (
      <Drawer
        placement="left"
        open={drawerOpen}
        onClose={onClose}
        width={220}
        title={<span style={{ color: '#fff' }}>AcademyHub</span>}
        closeIcon={<span style={{ color: 'rgba(255,255,255,0.65)' }}>✕</span>}
        styles={{
          body: { padding: 0, background: SIDER_BG },
          header: { background: SIDER_BG, borderBottom: '1px solid #1f1f1f' },
        }}
      >
        {menuContent}
      </Drawer>
    );
  }

  return <Sider>{menuContent}</Sider>;
};

export default function AppRouter() {
  const screens = Grid.useBreakpoint();
  const isMobile = screens.md === false;
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <Router>
      <Layout style={{ minHeight: '100vh' }}>
        <Sidebar
          isMobile={isMobile}
          drawerOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
        />
        <Layout>
          {isMobile && (
            <Header style={{ padding: '0 16px', display: 'flex', alignItems: 'center', background: SIDER_BG }}>
              <Button
                type="text"
                icon={<MenuOutlined style={{ color: '#fff', fontSize: 18 }} />}
                onClick={() => setDrawerOpen(true)}
              />
            </Header>
          )}
          <Content style={{ margin: '16px' }}>
            <Routes>
              <Route path="/" element={<HomeRoute />} />
              <Route path="/users" element={<UsersRoute />} />
              <Route path="/users/:id_user" element={<UserDetailRoute />} />
              <Route path="/groups" element={<GroupsRoute />} />
              <Route path="/courses" element={<CoursesRoute />} />
              <Route path="/courses/:id_course" element={<CourseDetailRoute />} />
              <Route path="/courses/:id_course/add-group" element={<CreateGroupRoute />} />
              <Route path="/users/create" element={<CreateUserRoute />} />
              <Route path="/add-course" element={<CreateCourseRoute />} />
              <Route path="/groups/:id_group/edit" element={<EditGroupRoute />} />
              <Route path="/companies" element={<CompaniesRoute />} />
              <Route path="/companies/:id_company" element={<CompanyDetailRoute />} />
              <Route path="/companies/:id_company/add-center" element={<CreateCenterRoute />} />
              <Route path="/centers/:id_center/edit" element={<EditCenterRoute />} />
              <Route path="/add-company" element={<CreateCompanyRoute />} />
              <Route path="/organization" element={<OrganizationSettingsPage />} />
              <Route path="/centers" element={<CentersRoute />} />
              <Route path="/reports" element={<ReportsRoute />} />
              <Route path="/tools" element={<ToolsRoute />} />
              <Route path="/tools/importaciones" element={<ToolList categoryKey="importaciones" />} />
              <Route path="/tools/gestion-acceso" element={<ToolList categoryKey="gestion-acceso" />} />
              <Route path="/tools/correo" element={<ToolList categoryKey="correo" />} />
              <Route path="/tools/herramientas" element={<ToolList categoryKey="herramientas" />} />
              <Route path="/tools/data-cross-reference" element={<DataCrossReferenceRoute />} />
              <Route path="/tools/user-management" element={<UserManagementRoute />} />
              <Route path="/tools/merge-duplicates" element={<MergeDuplicatesRoute />} />
              <Route path="/tools/user-sanitization" element={<UserSanitizationRoute />} />
              <Route path="/tools/moodle-import" element={<MoodleImportRoute />} />
              <Route path="/tools/import-sage" element={<SageImportRoute />} />
              <Route path="/tools/import-inaem" element={<InaemImportRoute />} />
              <Route path="/tools/audit-log" element={<AuditLogRoute />} />
              <Route path="/tools/email-log" element={<EmailLogRoute />} />
              <Route path="/tools/forum-duplicator" element={<ForumDuplicatorRoute />} />
              <Route path="/tools/backups" element={<BackupsRoute />} />
              <Route path="/organization/smtp" element={<SmtpSettingsPage />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </Router>
  );
}
