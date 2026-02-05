import type { MenuItem as MenuItemType } from "@shared/types";

interface MenuItemProps {
  item: MenuItemType;
  onOrder: (item: MenuItemType) => void;
  disabled?: boolean;
}

export function MenuItem({ item, onOrder, disabled }: MenuItemProps) {
  return (
    <div className="menu-item">
      <div className="menu-item-info">
        <h3 className="menu-item-name">{item.name}</h3>
        {item.description && (
          <p className="menu-item-description">{item.description}</p>
        )}
        {item.category && (
          <span className="menu-item-category">{item.category}</span>
        )}
      </div>
      <div className="menu-item-actions">
        <span className="menu-item-price">${item.price.toFixed(2)}</span>
        <button
          className="order-button"
          onClick={() => onOrder(item)}
          disabled={disabled}
        >
          Order
        </button>
      </div>
    </div>
  );
}
