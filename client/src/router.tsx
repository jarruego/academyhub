import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomeRoute from './routes/home.route';

export default function Router() {
  return (
    <BrowserRouter>
        <Routes>
            <Route path="/" element={<HomeRoute />} />
        </Routes>
    </BrowserRouter>
  );
}
