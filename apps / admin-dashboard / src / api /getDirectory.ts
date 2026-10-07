import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';

export default createEndpoint({
  description: 'Lists all products and customers for management tables',
  inputSchema: z.object({}),
  outputSchema: z.object({}),
  execute: async () => {
    const [{ records: p }, { records: c }, stats] = await Promise.all([
      zite.products.findAll({ limit: 2000 }),
      zite.customers.findAll({ limit: 2000 }),
      zite.sql({
        query: `SELECT l."customersId" AS cid, COUNT(o.id) AS orders, COALESCE(SUM(o."totalValue"), 0) AS revenue
          FROM "CustomersOrders" l JOIN "Orders" o ON o.id = l."ordersId"
          WHERE COALESCE(o."orderStatus", 'Draft') <> 'Draft' GROUP BY l."customersId"`,
      }),
    ]);
    const stat = new Map(stats.rows.map((r) => [String(r.cid), { orders: Number(r.orders) || 0, revenue: Number(r.revenue) || 0 }]));
    return {
      products: p.map((x) => ({
        id: x.id, sku: x.sku ?? '', name: x.productName ?? '', category: x.category ?? '',
        imageUrl: x.image?.[0]?.url ?? '', basePrice: x.basePrice ?? 0, costPrice: x.costPrice ?? 0, rrp: x.rrp ?? null, stock: x.stockLevel ?? 0,
        status: x.availabilityStatus ?? 'Available',
      })),
      customers: c.map((x) => ({
        id: x.id, company: x.companyName ?? '', email: x.contactEmail ?? '', tier: x.tierLevel ?? 'Standard',
        address: x.shippingAddress ?? '', balance: x.totalBalance ?? 0,
        phone: x.phone ?? '', orders: stat.get(x.id)?.orders ?? 0, revenue: stat.get(x.id)?.revenue ?? 0,
        lat: x.latitude ?? null, lng: x.longitude ?? null, plusCode: x.plusCode ?? '',
      })),
    };
  },
});
