import { ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/** Renders its children inside the page's sticky header (falls back to inline if the page has none). */
export default function HeaderTools({ children }: { children: ReactNode }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [checked, setChecked] = useState(false);
  useEffect(() => { setEl(document.getElementById('page-header-tools')); setChecked(true); }, []);
  if (!checked) return null;
  return el ? createPortal(children, el) : <div className="mb-4">{children}</div>;
}
