import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';

const n = (v: unknown) => Number(v ?? 0) || 0;

export default createEndpoint({
  description: 'Summarises sales, cost of goods, payments, expenses and profit for the dashboard',
  inputSchema: z.object({ from: z.string().optional(), to: z.string().optional() }),
  outputSchema: z.object({}),
  execute: async ({ input }) => {
    const from = input.from ?? '1900-01-01';
    const to = input.to ?? '2999-12-31';
    const sales = zite.sql({
      query: `
        SELECT to_char(COALESCE(o."datePlaced", o.created_at), 'YYYY-MM') AS month,
          COUNT(DISTINCT o.id) AS orders,
          COALESCE(SUM(oi."quantity" * oi."unitPrice"), 0) AS revenue,
          COALESCE(SUM(oi."quantity" * COALESCE(p."costPrice", 0)), 0) AS cogs
        FROM "Orders" o
        LEFT JOIN "OrderItemsOrders" l ON l."ordersId" = o.id
        LEFT JOIN "OrderItems" oi ON oi.id = l."orderItemsId"
        LEFT JOIN "OrderItemsProducts" lp ON lp."orderItemsId" = oi.id
        LEFT JOIN "Products" p ON p.id = lp."productsId"
        WHERE COALESCE(o."orderStatus", 'Draft') <> 'Draft'
          AND COALESCE(o."datePlaced", o.created_at)::date BETWEEN $1::date AND $2::date
        GROUP BY 1 ORDER BY 1`,
      params: [from, to],
    });
    const pays = zite.sql({
      query: `SELECT to_char(COALESCE("paymentDate", created_at), 'YYYY-MM') AS month, COALESCE(SUM("amountPaid"), 0) AS collected
        FROM "Payments" WHERE COALESCE("paymentDate", created_at)::date BETWEEN $1::date AND $2::date GROUP BY 1`,
      params: [from, to],
    });
    const exps = zite.sql({
      query: `SELECT to_char(COALESCE("expenseDate", created_at), 'YYYY-MM') AS month, COALESCE("category", 'Other') AS category, COALESCE(SUM("amount"), 0) AS amount
        FROM "Expenses" WHERE COALESCE("expenseDate", created_at)::date BETWEEN $1::date AND $2::date GROUP BY 1, 2`,
      params: [from, to],
    });
    const top = zite.sql({
      query: `
        SELECT p."productName" AS name, COALESCE(SUM(oi."quantity"), 0) AS qty,
          COALESCE(SUM(oi."quantity" * oi."unitPrice"), 0) AS revenue,
          COALESCE(SUM(oi."quantity" * (oi."unitPrice" - COALESCE(p."costPrice", 0))), 0) AS profit
        FROM "Orders" o
        JOIN "OrderItemsOrders" l ON l."ordersId" = o.id
        JOIN "OrderItems" oi ON oi.id = l."orderItemsId"
        JOIN "OrderItemsProducts" lp ON lp."orderItemsId" = oi.id
        JOIN "Products" p ON p.id = lp."productsId"
        WHERE COALESCE(o."orderStatus", 'Draft') <> 'Draft'
          AND COALESCE(o."datePlaced", o.created_at)::date BETWEEN $1::date AND $2::date
        GROUP BY p.id ORDER BY revenue DESC LIMIT 5`,
      params: [from, to],
    });
    const [s, p, e, t] = await Promise.all([sales, pays, exps, top]);

    const months = new Map<string, { month: string; revenue: number; cogs: number; expenses: number; collected: number; orders: number }>();
    const m = (k: string) => {
      if (!months.has(k)) months.set(k, { month: k, revenue: 0, cogs: 0, expenses: 0, collected: 0, orders: 0 });
      return months.get(k)!;
    };
    s.rows.forEach((r) => Object.assign(m(String(r.month)), { revenue: n(r.revenue), cogs: n(r.cogs), orders: n(r.orders) }));
    p.rows.forEach((r) => { m(String(r.month)).collected += n(r.collected); });
    const byCat = new Map<string, number>();
    e.rows.forEach((r) => {
      m(String(r.month)).expenses += n(r.amount);
      byCat.set(String(r.category), (byCat.get(String(r.category)) ?? 0) + n(r.amount));
    });
    const monthly = [...months.values()].sort((a, b) => a.month.localeCompare(b.month))
      .map((x) => ({ ...x, grossProfit: x.revenue - x.cogs, netProfit: x.revenue - x.cogs - x.expenses }));
    const sum = (k: 'revenue' | 'cogs' | 'expenses' | 'collected' | 'orders') => monthly.reduce((a, x) => a + x[k], 0);
    const revenue = sum('revenue'), cogs = sum('cogs'), expenses = sum('expenses');

    return {
      totals: {
        revenue, cogs, expenses, collected: sum('collected'), orders: sum('orders'),
        grossProfit: revenue - cogs, netProfit: revenue - cogs - expenses,
        grossMargin: revenue ? ((revenue - cogs) / revenue) * 100 : 0,
      },
      monthly,
      expenseByCategory: [...byCat.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
      topProducts: t.rows.map((r) => ({ name: String(r.name ?? 'Unknown'), qty: n(r.qty), revenue: n(r.revenue), profit: n(r.profit) })),
    };
  },
});
