import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from 'react';

// A tiny path-based router. Cloudflare serves index.html for unknown paths
// (single-page-application mode), so deep links such as /app/tailor work.

const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener('popstate', cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('popstate', cb);
  };
}

export function navigate(path: string, opts: { replace?: boolean } = {}) {
  if (path === window.location.pathname + window.location.hash) return;
  if (opts.replace) window.history.replaceState(null, '', path);
  else window.history.pushState(null, '', path);
  listeners.forEach((l) => l());
  const hash = path.split('#')[1];
  if (hash) {
    requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' }));
  } else {
    window.scrollTo(0, 0);
  }
}

export function usePath(): string {
  return useSyncExternalStore(subscribe, () => window.location.pathname);
}

export function Link({ href, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    if (/^https?:|^mailto:/.test(href)) return;
    e.preventDefault();
    navigate(href);
  };
  return <a href={href} onClick={handle} {...rest} />;
}
