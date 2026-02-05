import { useState } from "react";
import { barmanApi } from "../api/barmanApi";

interface LoginPageProps {
  onLogin: (barmanId: string, barmanName: string) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const barman = await barmanApi.register(name.trim());
      onLogin(barman.id, name.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <h1 className="login-title">Barman Dashboard</h1>
        <p className="login-subtitle">Enter your name to start</p>

        <form onSubmit={handleSubmit} className="login-form">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="login-input"
            disabled={loading}
            autoFocus
          />

          {error && <div className="login-error">{error}</div>}

          <button
            type="submit"
            className="login-button"
            disabled={loading || !name.trim()}
          >
            {loading ? "Starting..." : "Start Working"}
          </button>
        </form>
      </div>
    </div>
  );
}
