"use client";

import Link from "next/link";
import { animate, motion, useInView, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { useEffect, useRef } from "react";
import type { MouseEvent, ReactNode } from "react";

export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reducedMotion ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.16 }}
      transition={{ duration: reducedMotion ? 0 : 0.55, delay: reducedMotion ? 0 : delay, ease: [0.2, 0.7, 0.25, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function MagneticLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const reducedMotion = useReducedMotion();

  function magnetize(event: MouseEvent<HTMLAnchorElement>) {
    if (reducedMotion || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left - bounds.width / 2) * 0.1;
    const y = (event.clientY - bounds.top - bounds.height / 2) * 0.1;
    event.currentTarget.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }

  return (
    <Link
      href={href}
      className={className}
      onMouseMove={magnetize}
      onMouseLeave={(event) => { event.currentTarget.style.transform = ""; }}
    >
      {children}
    </Link>
  );
}

export function AnimatedCounter({ value, suffix = "" }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.7 });
  const reducedMotion = useReducedMotion();
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => Math.round(latest));

  useEffect(() => {
    if (!inView) return;
    if (reducedMotion) {
      count.set(value);
      return;
    }
    const controls = animate(count, value, { duration: 0.8, ease: "easeOut" });
    return () => controls.stop();
  }, [count, inView, reducedMotion, value]);

  return <span ref={ref} className="tabular-nums"><motion.span>{rounded}</motion.span>{suffix}</span>;
}
