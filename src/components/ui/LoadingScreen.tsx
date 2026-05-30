import React from 'react';
import { motion } from 'framer-motion';
import { Church } from 'lucide-react';

export default function LoadingScreen({ message = 'Memuat...' }) {
  return (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-50">
      <div className="flex flex-col items-center gap-5">

        {/* Logo with pulse ring */}
        <div className="relative">
          {/* Outer pulse ring */}
          <motion.div
            className="absolute inset-0 rounded-2xl bg-brand-800/20"
            animate={{ scale: [1, 1.5, 1.5], opacity: [0.5, 0, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
          />
          {/* Logo box */}
          <motion.div
            className="relative w-16 h-16 bg-brand-800 rounded-2xl flex items-center justify-center shadow-lg"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            <motion.div
              animate={{ rotate: [0, -5, 5, -3, 3, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1.5 }}
            >
              <Church size={28} className="text-white" />
            </motion.div>
          </motion.div>
        </div>

        {/* Title */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
        >
          <div className="font-bold text-xl text-brand-800 tracking-tight">SIGMA</div>
          <div className="text-xs text-gray-400 mt-0.5">Misdinar Kristus Raja Solo Baru</div>
        </motion.div>

        {/* Animated dots */}
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              className="w-2 h-2 bg-brand-800 rounded-full"
              animate={{ scale: [0.6, 1, 0.6], opacity: [0.4, 1, 0.4] }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                delay: i * 0.2,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>

        {/* Message */}
        <motion.p
          className="text-sm text-gray-400"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          {message}
        </motion.p>
      </div>
    </div>
  );
}
