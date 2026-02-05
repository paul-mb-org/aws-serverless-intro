import { useState, useEffect } from "react";
import { AuthGuard } from "./components/AuthGuard";
import { DashboardPage } from "./pages/DashboardPage";
import "./App.css";

const STORAGE_KEY_ID = "barmanId";
const STORAGE_KEY_NAME = "barmanName";

function App() {
  const [barmanId, setBarmanId] = useState<string | null>(null);
  const [barmanName, setBarmanName] = useState<string | null>(null);

  useEffect(() => {
    const storedId = localStorage.getItem(STORAGE_KEY_ID);
    const storedName = localStorage.getItem(STORAGE_KEY_NAME);
    if (storedId && storedName) {
      setBarmanId(storedId);
      setBarmanName(storedName);
    }
  }, []);

  const handleLogin = (id: string, name: string) => {
    localStorage.setItem(STORAGE_KEY_ID, id);
    localStorage.setItem(STORAGE_KEY_NAME, name);
    setBarmanId(id);
    setBarmanName(name);
  };

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY_ID);
    localStorage.removeItem(STORAGE_KEY_NAME);
    setBarmanId(null);
    setBarmanName(null);
  };

  return (
    <div className="barman-app">
      <AuthGuard barmanId={barmanId} barmanName={barmanName} onLogin={handleLogin}>
        <DashboardPage
          barmanId={barmanId!}
          barmanName={barmanName!}
          onLogout={handleLogout}
        />
      </AuthGuard>
    </div>
  );
}

export default App;
