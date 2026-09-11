import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import HomeRoute from './routes/home.route';
import UsersRoute from './routes/users/users.route';
import GroupsRoute from './routes/groups/groups.route';
import CoursesRoute from './routes/courses/courses.route';
import CourseDetailRoute from './routes/courses/course-detail.route';
import CourseCatalogRoute from './routes/course-catalog/course-catalog.route';
import CreateCatalogCourseRoute from './routes/course-catalog/create-catalog-course.route';
import CatalogCourseDetailRoute from './routes/course-catalog/catalog-course-detail.route';
import CourseInterestsRoute from './routes/course-catalog/course-interests.route';
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
import CourseRequestsRoute from './routes/course-requests/course-requests.route';
import CreateCourseRequestRoute from './routes/course-requests/create-course-request.route';
import CourseRequestDetailRoute from './routes/course-requests/course-request-detail.route';
import { Layout, Menu, Button, Drawer, theme } from 'antd';
import type { MenuProps } from 'antd';
import { useAuthInfo } from './providers/auth/auth.context';
import { useIsMobile } from './hooks/use-is-mobile';
import { UiPreferencesControl } from './components/common/UiPreferencesControl';
import ToolsRoute from './routes/tools/tools.route';
import ToolList from './components/tools/ToolList';
import DataCrossReferenceRoute from './routes/tools/data-cross-reference.route';
import MoodleImportRoute from './routes/tools/moodle-import.route';
import SageImportRoute from './routes/tools/import-sage.route';
import InaemImportRoute from './routes/tools/import-inaem.route';
import AuditLogRoute from './routes/tools/audit-log.route';
import EmailLogRoute from './routes/tools/email-log.route';
import SmsLogRoute from './routes/tools/sms-log.route';
import ForumDuplicatorRoute from './routes/tools/forum-duplicator.route';
import MergeDuplicatesRoute from './routes/tools/merge-duplicates.route';
import MoodleAuditRoute from './routes/tools/moodle-audit.route';
import UserSanitizationRoute from './routes/tools/user-sanitization.route';
import BackupsRoute from './routes/tools/backups.route';
import UserManagementRoute from './routes/auth-users/auth-user-management.route';
import ReportsRoute from './routes/reports/reports.route';
import OrganizationSettingsPage from './routes/organization/OrganizationSettingsPage';
import SmtpSettingsPage from './routes/mail/smtp-settings.route';
import MailTemplatesPage from './routes/mail/mail-templates.route';
import SmsSettingsPage from './routes/sms/sms-settings.route';
import SmsTemplatesPage from './routes/sms/sms-templates.route';
import HelpRoute from './routes/help/help.route';
import TourProvider from './providers/tour/tour.context';
import SidebarTour from './components/tour/SidebarTour';
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
  MobileOutlined,
  MenuOutlined,
  FileTextOutlined,
  SafetyCertificateOutlined,
  PoweroffOutlined,
  SolutionOutlined,
  ReadOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';

const { Sider, Content, Header } = Layout;

const SIDER_BG = '#001529';

interface SidebarProps {
  isMobile: boolean;
  drawerOpen: boolean;
  onClose: () => void;
}

// Rutas de nivel superior que sí tienen un ítem de menú propio (hoja). Se usan
// para calcular qué ítem debe quedar seleccionado según la URL actual — antes
// la selección la llevaba el propio `Menu` de forma interna (uncontrolled) y
// solo reaccionaba al click, así que se perdía al recargar o navegar por URL.
const MENU_LEAF_KEYS = [
  '/', '/users', '/courses', '/groups', '/course-requests', '/centers', '/reports', '/organization',
  '/tools/importaciones', '/tools/gestion-acceso', '/tools/correo', '/tools/sms', '/tools/herramientas',
];

const selectedLeafKey = (pathname: string) => MENU_LEAF_KEYS
  .filter(key => key === '/' ? pathname === '/' : (pathname === key || pathname.startsWith(`${key}/`)))
  .sort((a, b) => b.length - a.length)[0];

const Sidebar = ({ isMobile, drawerOpen, onClose }: SidebarProps) => {
  const { logout } = useAuthInfo();
  const role = useRole();
  const { pathname } = useLocation();
  const { token } = theme.useToken();

  type MenuItem = NonNullable<MenuProps['items']>[number];

  // "Cursos"/"Empresas" son cabeceras de grupo (`type: 'group'`), no ítems
  // seleccionables para antd, aunque su título enlaza a una página real
  // (/course-catalog, /companies). Como el `Menu` nunca las puede marcar como
  // seleccionadas por su cuenta, se calcula "a mano" y se replica el estilo del
  // ítem seleccionado real (mismo verde de marca, mismo margen/radio — ver
  // comprobación en devtools) solo mientras esa página esté activa.
  const isCoursesGroupActive = pathname === '/course-catalog' || pathname.startsWith('/course-catalog/');
  const isCompaniesGroupActive = pathname === '/companies' || pathname === '/add-company' || pathname.startsWith('/companies/');
  const activeGroupLinkStyle = { backgroundColor: token.colorPrimary, color: '#fff', margin: 4, width: 'calc(100% - 8px)', borderRadius: 8 };

  const selectedKeys = selectedLeafKey(pathname) ? [selectedLeafKey(pathname) as string] : [];

  // onClose is called on every leaf Link click so the drawer closes on navigation.
  // On desktop onClose is a no-op.
  const menuItems: NonNullable<MenuProps['items']> = [
    { key: '/', icon: <HomeOutlined />, label: <Link to="/" onClick={onClose}>Home</Link> },
    { key: '/users', icon: <UserOutlined />, label: <Link to="/users" onClick={onClose}>Usuarios</Link> },
    {
      type: 'group',
      key: 'cursos-group',
      label: <Link to="/course-catalog" onClick={onClose} className="app-sider-group-title" style={isCoursesGroupActive ? activeGroupLinkStyle : undefined}><ReadOutlined /><span>Cursos</span></Link>,
      children: [
        { key: '/courses', icon: <BookOutlined />, className: 'app-sider-child-item', label: <Link to="/courses" onClick={onClose}>Ediciones</Link> },
        { key: '/groups', icon: <TeamOutlined />, className: 'app-sider-child-item', label: <Link to="/groups" onClick={onClose}>Grupos</Link> },
        ...(role?.toLowerCase() === Role.ADMIN || role?.toLowerCase() === Role.MANAGER || role?.toLowerCase() === Role.VIEWER || role?.toLowerCase() === Role.TUTOR || role?.toLowerCase() === Role.CONSULTOR
          ? [{ key: '/course-requests', icon: <SolutionOutlined />, className: 'app-sider-child-item', label: <Link to="/course-requests" onClick={onClose}>Peticiones</Link> }]
          : []),
      ],
    },
    {
      type: 'group',
      key: 'empresas-group',
      label: <Link to="/companies" onClick={onClose} className="app-sider-group-title" style={isCompaniesGroupActive ? activeGroupLinkStyle : undefined}><BankOutlined /><span>Empresas</span></Link>,
      children: [
        { key: '/centers', icon: <ApartmentOutlined />, className: 'app-sider-child-item', label: <Link to="/centers" onClick={onClose}>Centros</Link> },
      ],
    },
    ...(role?.toLowerCase() === Role.ADMIN || role?.toLowerCase() === Role.MANAGER || role?.toLowerCase() === Role.VIEWER || role?.toLowerCase() === Role.TUTOR || role?.toLowerCase() === Role.CONSULTOR
      ? [{ key: '/reports', icon: <PieChartOutlined />, label: <Link to="/reports" onClick={onClose}>Informes</Link> }]
      : []),
  ];

  if (role?.toLowerCase() === Role.ADMIN) {
    const adminChildren: MenuItem[] = [
      { key: '/organization', icon: <SettingOutlined />, label: <Link to="/organization" onClick={onClose}>Organización</Link> },
      { key: '/tools/importaciones', icon: <FileTextOutlined />, label: <Link to="/tools/importaciones" onClick={onClose}>Importaciones</Link> },
      { key: '/tools/gestion-acceso', icon: <SafetyCertificateOutlined />, label: <Link to="/tools/gestion-acceso" onClick={onClose}>Gestión y acceso</Link> },
      { key: '/tools/correo', icon: <MailOutlined />, label: <Link to="/tools/correo" onClick={onClose}>Correo</Link> },
      { key: '/tools/sms', icon: <MobileOutlined />, label: <Link to="/tools/sms" onClick={onClose}>SMS</Link> },
      { key: '/tools/herramientas', icon: <ToolOutlined />, label: <Link to="/tools/herramientas" onClick={onClose}>Herramientas</Link> },
    ];
    menuItems.push({ key: 'administracion', icon: <SettingOutlined />, label: <span>Administración</span>, children: adminChildren });
  }

  const menuContent = (
    <>
      <Menu theme="dark" mode="inline" items={menuItems} selectedKeys={selectedKeys} />
      <div className="app-sider-footer">
        <Link to="/help" onClick={onClose}>
          <Button icon={<QuestionCircleOutlined />} block>Ayuda</Button>
        </Link>
        <UiPreferencesControl />
        <Button danger icon={<PoweroffOutlined />} onClick={logout} block>
          Cerrar sesión
        </Button>
      </div>
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
        classNames={{ body: 'app-sider-drawer-body' }}
        styles={{
          body: { padding: 0, background: SIDER_BG },
          header: { background: SIDER_BG, borderBottom: '1px solid #1f1f1f' },
        }}
      >
        {menuContent}
      </Drawer>
    );
  }

  return <Sider className="app-sider">{menuContent}</Sider>;
};

export default function AppRouter() {
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <Router>
      <TourProvider>
      <Layout style={{ minHeight: '100vh' }}>
        <SidebarTour />
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
              <Route path="/course-catalog" element={<CourseCatalogRoute />} />
              <Route path="/course-catalog/create" element={<CreateCatalogCourseRoute />} />
              <Route path="/course-catalog/interests" element={<CourseInterestsRoute />} />
              <Route path="/course-catalog/:id_catalog_course" element={<CatalogCourseDetailRoute />} />
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
              <Route path="/course-requests" element={<CourseRequestsRoute />} />
              <Route path="/course-requests/create" element={<CreateCourseRequestRoute />} />
              <Route path="/course-requests/:id_request" element={<CourseRequestDetailRoute />} />
              <Route path="/reports" element={<ReportsRoute />} />
              <Route path="/tools" element={<ToolsRoute />} />
              <Route path="/tools/importaciones" element={<ToolList categoryKey="importaciones" />} />
              <Route path="/tools/gestion-acceso" element={<ToolList categoryKey="gestion-acceso" />} />
              <Route path="/tools/correo" element={<ToolList categoryKey="correo" />} />
              <Route path="/tools/sms" element={<ToolList categoryKey="sms" />} />
              <Route path="/tools/herramientas" element={<ToolList categoryKey="herramientas" />} />
              <Route path="/tools/data-cross-reference" element={<DataCrossReferenceRoute />} />
              <Route path="/tools/user-management" element={<UserManagementRoute />} />
              <Route path="/tools/merge-duplicates" element={<MergeDuplicatesRoute />} />
              <Route path="/tools/moodle-audit" element={<MoodleAuditRoute />} />
              <Route path="/tools/user-sanitization" element={<UserSanitizationRoute />} />
              <Route path="/tools/moodle-import" element={<MoodleImportRoute />} />
              <Route path="/tools/import-sage" element={<SageImportRoute />} />
              <Route path="/tools/import-inaem" element={<InaemImportRoute />} />
              <Route path="/tools/audit-log" element={<AuditLogRoute />} />
              <Route path="/tools/email-log" element={<EmailLogRoute />} />
              <Route path="/tools/sms-log" element={<SmsLogRoute />} />
              <Route path="/tools/forum-duplicator" element={<ForumDuplicatorRoute />} />
              <Route path="/tools/backups" element={<BackupsRoute />} />
              <Route path="/organization/smtp" element={<SmtpSettingsPage />} />
              <Route path="/organization/mail-templates" element={<MailTemplatesPage />} />
              <Route path="/organization/sms" element={<SmsSettingsPage />} />
              <Route path="/organization/sms-templates" element={<SmsTemplatesPage />} />
              <Route path="/help" element={<HelpRoute />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
      </TourProvider>
    </Router>
  );
}
