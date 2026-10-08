import { useEffect, useState, useCallback, RefObject } from "react";

export function useInView(options: {
  threshold?: number | number[];
  root?: Element | null;
  rootMargin?: string;
} = {}): [RefObject<HTMLElement>, boolean] {
  const { threshold = 0.1, root = null, rootMargin = "0px" } = options;
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>();
  const [node, setNode] = useState<HTMLElement | null>(null);

  const ref = useCallback(
    (node: HTMLElement | null) => {
      if (node) {
        setNode(node);
      }
    },
    []
  );

  useEffect(() => {
    if (!node) return;

    const observer = new IntersectionObserver(([entry]) => {
      setEntry(entry);
    }, { threshold, root, rootMargin });

    observer.observe(node);
    return () => observer.disconnect();
  }, [node, threshold, root, rootMargin]);

  return [ref, !!entry?.isIntersecting];
}