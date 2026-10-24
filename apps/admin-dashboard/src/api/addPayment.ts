import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { recordPayment } from '../lib/orders';

export default createEndpoint({
  description: 'Records a payment against an order and updates the customer balance',
  inputSchema: z.object({
    orderId: z.string(),
    amount: z.number().positive(),
    method: z.enum(['Bank Transfer', 'Mobile Money', 'Card', 'Cash']),
    date: z.string(),
    reference: z.string().optional(),
  }),
  outputSchema: z.object({ paymentStatus: z.string() }),
  execute: async ({ input }) => ({ paymentStatus: await recordPayment(input) }),
});
