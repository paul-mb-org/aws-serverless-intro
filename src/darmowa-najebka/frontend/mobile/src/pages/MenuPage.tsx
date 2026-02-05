import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { customerApi } from "../api/customerApi";
import { MenuItem } from "../components/MenuItem";
import type { MenuItem as MenuItemType } from "@shared/types";

function getOrCreateCustomerId(): string {
  const key = "customerId";
  let customerId = localStorage.getItem(key);
  if (!customerId) {
    customerId = crypto.randomUUID();
    localStorage.setItem(key, customerId);
  }
  return customerId;
}

export function MenuPage() {
  const [menu, setMenu] = useState<MenuItemType[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordering, setOrdering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchMenu() {
      try {
        const items = await customerApi.getMenu();
        setMenu(items);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load menu");
      } finally {
        setLoading(false);
      }
    }
    fetchMenu();
  }, []);

  const handleOrder = async (item: MenuItemType) => {
    setOrdering(true);
    setError(null);
    try {
      const customerId = getOrCreateCustomerId();
      const response = await customerApi.createOrder(customerId, item);
      navigate(`/order/${response.orderId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to place order");
      setOrdering(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading">Loading menu...</div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <header className="page-header">
        <h1>Drinks Menu</h1>
        <p>Select a drink to order</p>
      </header>

      {error && <div className="error-message">{error}</div>}

      <div className="menu-list">
        {menu.length === 0 ? (
          <p className="empty-message">No drinks available at the moment</p>
        ) : (
          menu.map((item) => (
            <MenuItem
              key={item.id}
              item={item}
              onOrder={handleOrder}
              disabled={ordering}
            />
          ))
        )}
      </div>
    </div>
  );
}
