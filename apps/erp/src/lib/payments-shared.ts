export type GatewayPaymentMethod = 'cash' | 'card' | 'account';

export type MockPaymentResult =
  | {
      ok: true;
      reference: string;
      method: GatewayPaymentMethod;
      amount: number;
      simulatedAt: string;
    }
  | {
      ok: false;
      error: string;
      declineCode?: string;
    };

export type PaymentGatewayContext = 'pos' | 'sales';
