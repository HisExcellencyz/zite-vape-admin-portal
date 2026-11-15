import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';

const asArray = (v: string | string[] | null | undefined) => (v == null || v === '' ? [] : Array.isArray(v) ? v : [v]);
const which = z.enum(['keep', 'merge']);

// Two records for one business, typically one the admin added and one the partner registered
// on the Portal. The kept record takes over everything of the other one: its orders (with their
// items and payments), its balance and its Portal sign-ins, so the partner keeps their access.
// For each detail the admin chooses which record's value stays. The other record is then deleted.
export default createEndpoint({
  description: 'Merges two customer companies into one: orders, balance and Portal sign-ins move to the kept company',
  inputSchema: z.object({
    keepId: z.string(),
    mergeId: z.string(),
    /** Which record's value to keep for each detail (blank values are filled from the other record). */
    use: z.object({ company: which, email: which, phone: which, address: which }),
  }),
  outputSchema: z.object({ movedOrders: z.number(), portalUsers: z.number() }),
  execute: async ({ input }) => {
    if (input.keepId === input.mergeId) throw new Error('Choose two different customers to merge');
    const [keep, other] = await Promise.all([
      zite.customers.findOne({ id: input.keepId }),
      zite.customers.findOne({ id: input.mergeId }),
    ]);
    if (!keep || !other) throw new Error('One of the customers no longer exists. Refresh the page and try again.');

    // 1. Orders move to the kept company (order items and payments hang off the orders, so they follow).
    const { rows } = await zite.sql({
      query: `SELECT "ordersId" FROM "CustomersOrders" WHERE "customersId" = $1`,
      params: [input.mergeId],
    });
    const orderIds = [...new Set(rows.map((r) => String(r.ordersId)))];
    for (let i = 0; i < orderIds.length; i += 10) {
      await Promise.all(orderIds.slice(i, i + 10).map((id) => zite.orders.update({ id, record: { customer: input.keepId } as never })));
    }

    // 2. Details: the chosen record's value, or the other one's when the chosen value is blank.
    const pick = <T,>(choice: 'keep' | 'merge', a: T, b: T) => {
      const [first, second] = choice === 'keep' ? [a, b] : [b, a];
      return first === undefined || first === null || first === '' ? second : first;
    };
    // The address and its map pin travel together.
    const keepHasAddress = !!keep.shippingAddress || keep.latitude != null;
    const otherHasAddress = !!other.shippingAddress || other.latitude != null;
    const addressFromMerge = input.use.address === 'merge' ? otherHasAddress : !keepHasAddress && otherHasAddress;
    const portalUsers = [...new Set([...asArray(keep.portalUsers), ...asArray(other.portalUsers)])];
    const record = {
      companyName: pick(input.use.company, keep.companyName, other.companyName) ?? '',
      contactEmail: String(pick(input.use.email, keep.contactEmail, other.contactEmail) ?? '').trim().toLowerCase(),
      phone: pick(input.use.phone, keep.phone, other.phone) ?? '',
      shippingAddress: (addressFromMerge ? other.shippingAddress : keep.shippingAddress) ?? '',
      latitude: (addressFromMerge ? other.latitude : keep.latitude) ?? null,
      longitude: (addressFromMerge ? other.longitude : keep.longitude) ?? null,
      plusCode: (addressFromMerge ? other.plusCode : keep.plusCode) ?? '',
      totalBalance: Math.round(((keep.totalBalance ?? 0) + (other.totalBalance ?? 0)) * 100) / 100,
      portalUsers,
    };

    // 3. Remove the merged record first (its email may be the one kept), then save the kept one.
    await zite.customers.delete({ id: input.mergeId });
    await zite.customers.update({ id: input.keepId, record: record as never });
    return { movedOrders: orderIds.length, portalUsers: portalUsers.length };
  },
});
