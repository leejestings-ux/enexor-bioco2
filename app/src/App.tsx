import { BrowserRouter, Routes, Route } from 'react-router-dom';
import TSAModel from './TSAModel';
import FinancialApp from './FinancialApp';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<FinancialApp />} />
        <Route path="/tsa" element={<TSAModel />} />
      </Routes>
    </BrowserRouter>
  );
}
