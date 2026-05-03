import { useEffect, useRef, useState } from 'react';

/**
 * Returns a ref to attach to a sentinel element placed right after the sticky header.
 * `stuck` becomes true when the sentinel scrolls out of view — meaning the user has
 * scrolled past the original header position.
 */
export function useStickyHeader() {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const el = sentinelRef.current;
    /* c8 ignore next */
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setStuck(!entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { sentinelRef, stuck };
}
