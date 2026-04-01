"use client";

export * from "motion/react-client";
export { motion, AnimatePresence, MotionConfig, LazyMotion, domAnimation } from "motion/react";
export { useScroll, useTransform, useMotionValue, useInView } from "motion/react";

export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
