export type InventoryItemRow = {
  stock_item_id: string;
  stock_group_name: string;
  primary_sku: string | null;
  item_name: string;
  quantity: string | number | null;
  unit_code: string;
  rate: string | number | null;
  value: string | number | null;
};

export type GroupRollup = {
  group_name: string;
  total_quantity: string;
  total_value: string;
  item_count: number;
};
