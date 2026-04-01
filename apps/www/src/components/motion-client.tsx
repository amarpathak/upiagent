"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

export * from "motion/react-client";
export { motion, AnimatePresence, MotionConfig, LazyMotion, domAnimation } from "motion/react";
export { useScroll, useTransform, useMotionValue, useInView } from "motion/react";

export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
