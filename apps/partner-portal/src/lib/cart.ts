import { useEffect, useState, useCallback } from 'react';

const KEY = 'partner-cart';
type Cart = Record<string, number>;

const read = (): Cart => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
};

export function useCart() {
  const [cart, setCartState] = useState<Cart>(read);

  useEffect(() => {
    const sync = () => setCartState(read());
    window.addEventListener('cart-change', sync);
    return () => window.removeEventListener('cart-change', sync);
  }, []);

  const setCart = useCallback((next: Cart) => {
    const clean = Object.fromEntries(Object.entries(next).filter(([, q]) => q > 0));
    localStorage.setItem(KEY, JSON.stringify(clean));
    window.dispatchEvent(new Event('cart-change'));
  }, []);

  return { cart, setCart };
}

export const money = (n: number) =>
  n.toLocaleString(undefined, { style: 'currency', currency: 'KES' });

export const orderCode = (n: number) => `ORD-${String(n).padStart(4, '0')}`;
