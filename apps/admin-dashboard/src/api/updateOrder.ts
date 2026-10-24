import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';

export default createEndpoint({
  description: "Updates an order's status or tracking number",
  inputSchema: z.object({
    id: z.string(),
    status: z.enum(['Submitted', 'Awaiting Deposit', 'Processing', 'Completed']).optional(),
    trackingNumber: z.string().optional(),
  }),
  outputSchema: z.object({ success: z.boolean() }),
  execute: async ({ input }) => {
    await zite.orders.update({
      id: input.id,
      record: {
        ...(input.status ? { orderStatus: input.status } : {}),
        ...(input.trackingNumber !== undefined ? { trackingNumber: input.trackingNumber } : {}),
      } as never,
    });
    return { success: true };
  },
});
