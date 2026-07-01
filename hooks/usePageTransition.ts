import { useEffect, useRef, useState } from 'react';

export function usePageTransition() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 10);
    return () => window.clearTimeout(timer);
  }, []);

  return { ref, className: `page-enter${visible ? ' page-visible' : ''}` };
}

