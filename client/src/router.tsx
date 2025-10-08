import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import HomeRoute from './routes/home.route';
import UsersRoute from './routes/users/users.route';
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
import CreateUserGroupRoute from './routes/groups/create-user-group.route';
import CentersRoute from './routes/centers/centers.route'; 
import ImportUsersToGroupRoute from './routes/users/import-users-to-group.route';
import { Layout, Menu, Button } from 'antd';
import { useAuthInfo } from './providers/auth/auth.context';
import ToolsRoute from './routes/tools/tools.route';
import DataCrossReferenceRoute from './routes/tools/data-cross-reference.route';
import { useRole } from './utils/permissions/use-role';
import { Role } from './hooks/api/auth/use-login.mutation';
import {
  HomeOutlined,
  UserOutlined,
  BookOutlined,
  ApartmentOutlined,
  BankOutlined,
  ToolOutlined
} from '@ant-design/icons';

const { Sider, Content } = Layout;

const Sidebar = () => {
  const { logout } = useAuthInfo();
  const role = useRole();
  console.log('ROL ACTUAL:', role);

  const menuItems = [
    { key: '/', icon: <HomeOutlined />, label: <Link to="/">Home</Link> },
    { key: '/users', icon: <UserOutlined />, label: <Link to="/users">Usuarios</Link> },
    { key: '/courses', icon: <BookOutlined />, label: <Link to="/courses">Cursos</Link> },
    { key: '/companies', icon: <BankOutlined />, label: <Link to="/companies">Empresas</Link> },
    { key: '/centers', icon: <ApartmentOutlined />, label: <Link to="/centers">Centros</Link> },
    ...(role?.toLowerCase() === Role.ADMIN
      ? [{ key: '/tools', icon: <ToolOutlined />, label: <Link to="/tools">Herramientas</Link> }]
      : []),
  ];

  return (
    <Sider>
      <Menu
        theme="dark"
        mode="inline"
        items={menuItems}
      />
      <Button onClick={logout} style={{ margin: '16px' }}>Cerrar sesión</Button>
    </Sider>
  );
};

export default function AppRouter() {
  return (
    <Router>
      <Layout style={{ minHeight: '100vh' }}>
        <Sidebar />
        <Layout>
          <Content style={{ margin: '16px' }}>
            <Routes>
              <Route path="/" element={<HomeRoute />} />
              <Route path="/users" element={<UsersRoute />} />
              <Route path="/users/:id_user" element={<UserDetailRoute />} />
              <Route path="/courses" element={<CoursesRoute />} />
              <Route path="/courses/:id_course" element={<CourseDetailRoute />} />
              <Route path="/courses/:id_course/add-group" element={<CreateGroupRoute />} />
              <Route path="/users/create" element={<CreateUserRoute />} />
              <Route path="/add-course" element={<CreateCourseRoute />} />
              <Route path="/groups/:id_group/edit" element={<EditGroupRoute />} />
              <Route path="/groups/:id_group/add-user" element={<CreateUserGroupRoute />} />
              <Route path="/groups/:id_group/import-users" element={<ImportUsersToGroupRoute />} />
              <Route path="/companies" element={<CompaniesRoute />} />
              <Route path="/companies/:id_company" element={<CompanyDetailRoute />} />
              <Route path="/companies/:id_company/add-center" element={<CreateCenterRoute />} /> 
              <Route path="/centers/:id_center/edit" element={<EditCenterRoute />} /> 
              <Route path="/add-company" element={<CreateCompanyRoute />} />
              <Route path="/centers" element={<CentersRoute />} />
              <Route path="/tools" element={<ToolsRoute />} />
              <Route path="/tools/data-cross-reference" element={<DataCrossReferenceRoute />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </Router>
  );
}
