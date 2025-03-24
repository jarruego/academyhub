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

const { Sider, Content } = Layout;

const menuItems = [
  { key: '/', label: <Link to="/">Home</Link> },
  { key: '/users', label: <Link to="/users">Usuarios</Link> },
  { key: '/courses', label: <Link to="/courses">Cursos</Link> },
  { key: '/companies', label: <Link to="/companies">Empresas</Link> },
  { key: '/centers', label: <Link to="/centers">Centros</Link> }, 
];

const Sidebar = () => {
  const { logout } = useAuthInfo();

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
              <Route path="/centers" element={<CentersRoute />} /> // Añadir la nueva ruta de Centros
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </Router>
  );
}
