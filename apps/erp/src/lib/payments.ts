import type { GatewayPaymentMethod, MockPaymentResult } from './payments-shared';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mockReference(method: GatewayPaymentMethod) {
  const token = Date.now().toString(36).toUpperCase().slice(-8);
  return `MOCK-${method.toUpperCase()}-${token}`;
}

export async function processMockPayment(input: {
  amount: number;
  method: GatewayPaymentMethod;
  customerId?: string;
  simulateDecline?: boolean;
}): Promise<MockPaymentResult> {
  if (input.amount <= 0) {
    return { ok: false, error: 'Invalid amount' };
  }

  if (input.method === 'account' && !input.customerId) {
    return { ok: false, error: 'Customer account required for account payment' };
  }

  const waitMs = input.method === 'card' ? 1800 : input.method === 'account' ? 1200 : 400;
  await delay(waitMs);

  if (input.simulateDecline && input.method === 'card') {
    return {
      ok: false,
      error: 'Card declined by issuer',
      declineCode: 'MOCK_DECLINE',
    };
  }

  return {
    ok: true,
    reference: mockReference(input.method),
    method: input.method,
    amount: input.amount,
    simulatedAt: new Date().toISOString(),
  };
}
