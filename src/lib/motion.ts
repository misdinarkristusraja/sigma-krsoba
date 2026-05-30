import type { Variants, Transition } from 'framer-motion';

// ── Transitions ──────────────────────────────────────────────────
export const ease: Transition = { duration: 0.32, ease: [0.4, 0, 0.2, 1] };
export const spring: Transition = { type: 'spring', stiffness: 380, damping: 30 };
export const springSnappy: Transition = { type: 'spring', stiffness: 500, damping: 35 };

// ── Page ─────────────────────────────────────────────────────────
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { ...ease } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.18 } },
};

// ── Cards / grid items — staggered via custom index ──────────────
export const cardVariants: Variants = {
  hidden:  { opacity: 0, y: 18, scale: 0.97 },
  visible: (i: number = 0) => ({
    opacity: 1, y: 0, scale: 1,
    transition: { delay: i * 0.055, duration: 0.35, ease: [0.4, 0, 0.2, 1] },
  }),
};

// ── List rows ─────────────────────────────────────────────────────
export const rowVariants: Variants = {
  hidden:  { opacity: 0, x: -10 },
  visible: (i: number = 0) => ({
    opacity: 1, x: 0,
    transition: { delay: i * 0.04, duration: 0.28, ease: 'easeOut' },
  }),
};

// ── Pop-in (badges, icons, modals) ───────────────────────────────
export const popVariants: Variants = {
  hidden:  { scale: 0.75, opacity: 0 },
  visible: { scale: 1, opacity: 1, transition: { ...spring } },
};

// ── Slide up (sections, banners) ─────────────────────────────────
export const slideUp: Variants = {
  hidden:  { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { ...ease } },
};

// ── Container that staggers children ────────────────────────────
export const staggerContainer: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.08 } },
};

// ── Fade only (charts, heavy content) ────────────────────────────
export const fadeIn: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.5 } },
};
