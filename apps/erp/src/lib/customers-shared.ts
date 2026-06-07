export const CUSTOMER_TYPES = ['contractor', 'builder', 'retail'] as const;
export type CustomerType = (typeof CUSTOMER_TYPES)[number];

const TYPE_PRICE_LEVEL_NAMES: Record<CustomerType, string> = {
  contractor: 'Contractor',
  builder: 'Builder',
  retail: 'Retail',
};

export function defaultPriceLevelNameForType(customerType: string): string | null {
  if (customerType === 'contractor' || customerType === 'builder' || customerType === 'retail') {
    return TYPE_PRICE_LEVEL_NAMES[customerType];
  }
  return null;
}
