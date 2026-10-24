import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { integrations } from 'zitejs/integrations';
import { mergeIntoTabs } from '../lib/sheetArchive';

const SPREADSHEET_ID = '1wEMiVrXYL4yhqbH85L7oqI_psyr4N9QDjAn8llYNp6o';
// Column names match the existing tabs in "G-Shock Vapes Bulk Ordering"; rows are matched on ID
const ID = 'ID';
const arr = (v: string | string[] | undefined) => (v == null ? [] : Array.isArray(v) ? v : [v]);

export default createEndpoint({
  description: 'Archives customers, products, orders, line items, payments and expenses into fixed Google Sheets tabs, updating rows already there',
  inputSchema: z.object({}),
  outputSchema: z.object({ url: z.string(), added: z.number(), updated: z.number(), kept: z.number() }),
  execute: async () => {
    const [p, c, o, i, pay, exp] = await Promise.all([
      zite.products.findAll({ limit: 2000 }),
      zite.customers.findAll({ limit: 2000 }),
      zite.orders.findAll({ limit: 2000 }),
      zite.orderItems.findAll({ limit: 2000 }),
      zite.payments.findAll({ limit: 2000 }),
      zite.expenses.findAll({ limit: 2000 }),
    ]);
    const cust = new Map(c.records.map((x) => [x.id, x.companyName ?? '']));
    const prod = new Map(p.records.map((x) => [x.id, x.sku ?? '']));
    const ord = new Map(o.records.map((x) => [x.id, x.orderId ?? '']));

    const tabs = {
      Customers: c.records.map((x) => ({ [ID]: x.id, 'Company Name': x.companyName ?? '', 'Contact Email': x.contactEmail ?? '', 'Tier Level': x.tierLevel ?? '',
        'Shipping Address': x.shippingAddress ?? '', 'Total Balance': x.totalBalance ?? 0, Phone: x.phone ?? '' })),
      Products: p.records.map((x) => ({ [ID]: x.id, SKU: x.sku ?? '', 'Product Name': x.productName ?? '', Category: x.category ?? '', Image: x.image?.[0]?.url ?? '',
        'Base Price': x.basePrice ?? 0, 'Stock Level': x.stockLevel ?? 0, 'Availability Status': x.availabilityStatus ?? '', 'Cost Price': x.costPrice ?? 0, RRP: x.rrp ?? '' })),
      Orders: o.records.map((x) => ({ [ID]: x.id, 'Order ID': x.orderId ?? '', Customer: cust.get(arr(x.customer)[0] ?? '') ?? '', 'Date Placed': x.datePlaced ?? '',
        'Total Value': x.totalValue ?? 0, 'Order Status': x.orderStatus ?? '', 'Tracking Number': x.trackingNumber ?? '' })),
      'Order Items': i.records.map((x) => ({ [ID]: x.id, 'Line Label': x.lineLabel ?? '', Order: ord.get(arr(x.order)[0] ?? '') ?? '', Product: prod.get(arr(x.product)[0] ?? '') ?? '',
        Quantity: x.quantity ?? 0, 'Unit Price': x.unitPrice ?? 0 })),
      Payments: pay.records.map((x) => ({ [ID]: x.id, Reference: x.reference ?? '', Order: ord.get(arr(x.order)[0] ?? '') ?? '', 'Amount Paid': x.amountPaid ?? 0,
        'Payment Date': x.paymentDate ?? '', 'Payment Method': x.paymentMethod ?? '', 'Payment Status': x.paymentStatus ?? '' })),
      Expenses: exp.records.map((x) => ({ [ID]: x.id, Description: x.description ?? '', Amount: x.amount ?? 0, 'Expense Date': x.expenseDate ?? '',
        Category: x.category ?? '', Notes: x.notes ?? '' })),
    };

    const { accessToken } = await integrations.get('googlesheets');
    return mergeIntoTabs(accessToken, SPREADSHEET_ID, tabs, ID);
  },
});
