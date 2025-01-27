import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import HomeRoute from './routes/home.route';
import UsersRoute from './routes/users.route';
import CoursesRoute from './routes/courses.route';
import { Layout, Menu } from 'antd';

const { Sider, Content } = Layout;

const menuItems = [
  { key: '1', label: <Link to="/">Home</Link> },
  { key: '2', label: <Link to="/users">Usuarios</Link> },
  { key: '3', label: <Link to="/courses">Cursos</Link> },
];

export default function AppRouter() {
  return (
    <Router>
      <Layout style={{ minHeight: '100vh' }}>
        <Sider>
          <Menu theme="dark" mode="inline" items={menuItems} />
        </Sider>
        <Layout>
          <Content style={{ margin: '16px' }}>
            <Routes>
              <Route path="/" element={<HomeRoute />} />
              <Route path="/users" element={<UsersRoute />} />
              <Route path="/courses" element={<CoursesRoute />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </Router>
  );
}
