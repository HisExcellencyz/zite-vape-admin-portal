import { z } from 'zod';
import { createEndpoint } from 'zitejs/backend';
import { zite } from 'zitejs/db';
import { phoneDigits } from '@project/components/search/match';

/** Comparable phone number: digits, Kenyan numbers reduced to the last 9 (0712…, +254 712… are one number). */
const phoneKey = (p?: string | null) => { const d = phoneDigits(p); return d.length >= 7 ? d : ''; };

export default createEndpoint({
  description: 'Creates, updates or deletes a customer company; one company per contact email and phone number',
  inputSchema: z.object({
    id: z.string().optional(),
    delete: z.boolean().optional(),
    data: z.object({
      company: z.string(), email: z.string(), address: z.string(), phone: z.string().optional(),
      lat: z.number().nullable().optional(), lng: z.number().nullable().optional(), plusCode: z.string().optional(),
    }).optional(),
  }),
  outputSchema: z.object({ success: z.boolean() }),
  execute: async ({ input }) => {
    if (input.delete && input.id) {
      await zite.customers.delete({ id: input.id });
      return { success: true };
    }
    const d = input.data!;
    const email = d.email.trim().toLowerCase();
    const company = d.company.trim();
    if (!company) throw new Error('Company name is required');

    // One company per contact email (partners sign in with it) and per phone number, in any format.
    const { rows } = await zite.sql({ query: `SELECT id, "companyName", "contactEmail", "phone" FROM "Customers"` });
    const others = rows.filter(r => String(r.id) !== input.id);
    const byEmail = email && others.find(r => String(r.contactEmail || '').trim().toLowerCase() === email);
    if (byEmail) throw new Error(`${byEmail.companyName || 'Another company'} already uses the email ${email}`);
    const pk = phoneKey(d.phone);
    const byPhone = pk && others.find(r => phoneKey(String(r.phone || '')) === pk);
    if (byPhone) throw new Error(`${byPhone.companyName || 'Another company'} already uses the phone number ${byPhone.phone}`);

    // The tier is only set for new companies; editing keeps whatever tier the company has.
    const record = { companyName: company, contactEmail: email, shippingAddress: d.address, phone: d.phone ?? '', latitude: d.lat ?? null, longitude: d.lng ?? null, plusCode: d.plusCode ?? '' };
    if (input.id) await zite.customers.update({ id: input.id, record: record as never });
    else await zite.customers.create({ record: { ...record, tierLevel: 'Standard', totalBalance: 0 } as never });
    return { success: true };
  },
});
