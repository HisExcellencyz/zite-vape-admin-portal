import { z } from 'zod';
import { google } from 'googleapis';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';

const SPREADSHEET_ID = '1wEMiVrXYL4yhqbH85L7oqI_psyr4N9QDjAn8llYNp6o';
const arr = (v: string | string[] | undefined) => (v == null ? [] : Array.isArray(v) ? v : [v]);

export default createEndpoint({
  description: 'Archives products, customers, orders, line items and payments to new Google Sheets tabs',
  inputSchema: z.object({}),
  outputSchema: z.object({ url: z.string(), tabs: z.array(z.string()), rows: z.number() }),
  execute: async () => {
    const [p, c, o, i, pay] = await Promise.all([
      zite.products.findAll({ limit: 2000 }),
      zite.customers.findAll({ limit: 2000 }),
      zite.orders.findAll({ limit: 2000 }),
      zite.orderItems.findAll({ limit: 2000 }),
      zite.payments.findAll({ limit: 2000 }),
    ]);
    const cust = new Map(c.records.map((x) => [x.id, x.companyName ?? '']));
    const prod = new Map(p.records.map((x) => [x.id, x.sku ?? '']));
    const ord = new Map(o.records.map((x) => [x.id, x.orderId ?? '']));

    const stamp = new Date().toLocaleString('sv-SE', { timeZone: 'Africa/Nairobi' }).slice(0, 16).replace(':', '');
    const data: Record<string, (string | number)[][]> = {
      Products: [['SKU', 'Product Name', 'Category', 'Base Price', 'Stock Level', 'Status'],
        ...p.records.map((x) => [x.sku ?? '', x.productName ?? '', x.category ?? '', x.basePrice ?? 0, x.stockLevel ?? 0, x.availabilityStatus ?? ''])],
      Customers: [['Company', 'Contact Email', 'Shipping Address', 'Total Balance'],
        ...c.records.map((x) => [x.companyName ?? '', x.contactEmail ?? '', x.shippingAddress ?? '', x.totalBalance ?? 0])],
      Orders: [['Order ID', 'Customer', 'Date Placed', 'Status', 'Total Value', 'Tracking'],
        ...o.records.map((x) => [x.orderId ?? '', cust.get(arr(x.customer)[0] ?? '') ?? '', x.datePlaced ?? '', x.orderStatus ?? '', x.totalValue ?? 0, x.trackingNumber ?? ''])],
      'Order Items': [['Order ID', 'SKU', 'Quantity', 'Unit Price'],
        ...i.records.map((x) => [ord.get(arr(x.order)[0] ?? '') ?? '', prod.get(arr(x.product)[0] ?? '') ?? '', x.quantity ?? 0, x.unitPrice ?? 0])],
      Payments: [['Reference', 'Order ID', 'Amount Paid', 'Payment Date', 'Method', 'Status'],
        ...pay.records.map((x) => [x.reference ?? '', ord.get(arr(x.order)[0] ?? '') ?? '', x.amountPaid ?? 0, x.paymentDate ?? '', x.paymentMethod ?? '', x.paymentStatus ?? ''])],
    };

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: process.env.ZITE_GOOGLESHEETS_ACCESS_TOKEN });
    const sheets = google.sheets({ version: 'v4', auth });
    const tabs = Object.keys(data).map((k) => `${stamp} ${k}`);

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: tabs.map((title) => ({ addSheet: { properties: { title } } })) },
    });
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        valueInputOption: 'RAW',
        data: Object.values(data).map((values, idx) => ({ range: `'${tabs[idx]}'!A1`, values })),
      },
    });
    const rows = Object.values(data).reduce((s, v) => s + v.length - 1, 0);
    return { url: `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}`, tabs, rows };
  },
});
