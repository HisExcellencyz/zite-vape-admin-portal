import { getCatalog, GetCatalogOutputType } from 'zitejs/api';

// One shared catalog request. It starts while the app checks the company at
// sign-in, and Catalog / Quick Order reuse it instead of loading again.
// Kept for a minute so stock figures stay fresh.
const MAX_AGE = 60_000;
let pending: Promise<GetCatalogOutputType> | null = null;
let startedAt = 0;

export function loadCatalog(fresh = false): Promise<GetCatalogOutputType> {
  if (fresh || !pending || Date.now() - startedAt > MAX_AGE) {
    startedAt = Date.now();
    const p = getCatalog({});
    pending = p;
    p.catch(() => { if (pending === p) pending = null; });
  }
  return pending;
}

/** Call after an order changes stock so the next view reloads. */
export function clearCatalog() { pending = null; }
