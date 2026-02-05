import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MenuPage } from "./pages/MenuPage";
import { OrderPage } from "./pages/OrderPage";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Routes>
          <Route path="/" element={<MenuPage />} />
          <Route path="/order/:orderId" element={<OrderPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
