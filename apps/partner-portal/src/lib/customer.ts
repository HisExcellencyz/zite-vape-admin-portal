import { zite } from 'zitejs/db';
import { ZiteError } from 'zitejs/backend';

/** All partners pay the same catalog price. */
export const unitPrice = (base: number) => Math.round(base * 100) / 100;

const asArray = (v: string | string[] | undefined) => (v == null ? [] : Array.isArray(v) ? v : [v]);

/** Find the Customers record for the signed-in user (links by contact email on first login), or null. */
export async function findCustomerForUser(user: { id: string; email: string }) {
  const linked = await zite.customers.findOne({ filters: { portalUsers: user.id } });
  if (linked) return linked;
  const byEmail = await zite.customers.findOne({ filters: { contactEmail: user.email.toLowerCase() } });
  if (!byEmail) return null;
  await zite.customers.update({
    id: byEmail.id,
    record: { portalUsers: [...asArray(byEmail.portalUsers), user.id] } as never,
  });
  return byEmail;
}

export async function getCustomerForUser(user: { id: string; email: string }) {
  const c = await findCustomerForUser(user);
  if (!c) throw new ZiteError('Please finish setting up your company profile first.', 'FORBIDDEN');
  return c;
}

export { asArray };
