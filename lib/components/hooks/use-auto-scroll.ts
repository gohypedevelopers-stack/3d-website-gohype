import { useCallback, useEffect, useRef, useState } from "react";

type UseAutoScrollOptions = {
  smooth?: boolean;
  content?: any;
  threshold?: number;
  initialAutoScroll?: boolean;
};

export function useAutoScroll({
  smooth = false,
  content,
  threshold = 50,
  initialAutoScroll = true,
}: UseAutoScrollOptions) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [isAtBottom, setIsAtBottom] = useState<boolean>(true);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState<boolean>(
    initialAutoScroll
  );

  const scrollToBottom = useCallback(
    (behavior?: ScrollBehavior) => {
      const el = scrollRef.current;
      if (!el) return;
      const top = el.scrollHeight - el.clientHeight;
      if (top <= 0) return;
      el.scrollTo({ top, behavior: behavior ?? (smooth ? "smooth" : "auto") });
    },
    [smooth]
  );

  // When content changes and auto-scroll is enabled, scroll to bottom
  useEffect(() => {
    if (!autoScrollEnabled) return;
    // schedule on next frame so DOM updates finish
    const id = requestAnimationFrame(() => scrollToBottom());
    return () => cancelAnimationFrame(id);
  }, [content, autoScrollEnabled, scrollToBottom]);

  // Track whether user is at bottom and re-enable auto-scroll when they reach it
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
      setIsAtBottom(atBottom);
      if (atBottom) setAutoScrollEnabled(true);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    // initial check
    requestAnimationFrame(onScroll);

    return () => el.removeEventListener("scroll", onScroll);
  }, [threshold]);

  const disableAutoScroll = useCallback(() => setAutoScrollEnabled(false), []);

  return {
    scrollRef,
    isAtBottom,
    autoScrollEnabled,
    scrollToBottom,
    disableAutoScroll,
  } as const;
}
