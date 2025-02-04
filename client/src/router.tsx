import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import HomeRoute from './routes/home.route';
import UsersRoute from './routes/users.route';
import CoursesRoute from './routes/courses.route';
import CourseDetailRoute from './routes/course-detail.route';
import CreateUserRoute from './routes/create-user.route';
import CreateCourseRoute from './routes/create-course.route';
import UserDetailRoute from './routes/user-detail.route';
import CreateGroupRoute from './routes/create-group.route';
import EditGroupRoute from './routes/group-detail.route';
import CompaniesRoute from './routes/companies.route';
import CreateCompanyRoute from './routes/create-company.route';
import CompanyDetailRoute from './routes/company-detail.route';
import CreateCenterRoute from './routes/create-center.route';
import EditCenterRoute from './routes/center-detail.route'; 
import CreateUserGroupRoute from './routes/create-user-group.route';
import { Layout, Menu, Button } from 'antd';
import { useAuthInfo } from './providers/auth/auth.context';

const { Sider, Content } = Layout;

const menuItems = [
  { key: '1', label: <Link to="/">Home</Link> },
  { key: '2', label: <Link to="/users">Usuarios</Link> },
  { key: '3', label: <Link to="/courses">Cursos</Link> },
  { key: '4', label: <Link to="/companies">Empresas</Link> },
];

const Sidebar = () => {
  const { logout } = useAuthInfo();

  return (
    <Sider>
      <Menu theme="dark" mode="inline" items={menuItems} />
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
              <Route path="/companies" element={<CompaniesRoute />} />
              <Route path="/companies/:id_company" element={<CompanyDetailRoute />} />
              <Route path="/companies/:id_company/add-center" element={<CreateCenterRoute />} /> 
              <Route path="/centers/:id_center/edit" element={<EditCenterRoute />} /> 
              <Route path="/add-company" element={<CreateCompanyRoute />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </Router>
  );
}
