'use client';

import { motion } from 'framer-motion';
import { MessageSquareQuote } from 'lucide-react';

export function LoadingScreen() {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black">
            {/* Background Texture/Noise */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>

            <div className="relative flex flex-col items-center">
                {/* Logo Animation */}
                <motion.div
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{
                        scale: [0.7, 1.05, 1],
                        opacity: 1,
                    }}
                    transition={{
                        duration: 1.5,
                        ease: [0.22, 1, 0.36, 1]
                    }}
                    className="relative"
                >
                    {/* Pulsing Outer Glow */}
                    <motion.div
                        animate={{
                            scale: [1, 1.2, 1],
                            opacity: [0.3, 0.6, 0.3]
                        }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                        className="absolute inset-0 bg-white/20 blur-2xl rounded-full"
                    />

                    <div className="w-16 h-16 bg-white text-black rounded-2xl flex items-center justify-center shadow-[0_0_50px_rgba(255,255,255,0.2)] relative z-10">
                        <MessageSquareQuote className="w-8 h-8 text-black" />
                    </div>
                </motion.div>

                {/* Loading Text */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.2, duration: 1 }}
                    className="mt-8 flex flex-col items-center gap-2"
                >
                    <span className="text-xl font-black tracking-tighter text-white uppercase italic">
                        Replied
                    </span>

                    {/* Animated Progress Line */}
                    <div className="h-px w-24 bg-stone-900 overflow-hidden relative mt-2">
                        <motion.div
                            animate={{
                                x: ['-100%', '100%']
                            }}
                            transition={{
                                duration: 1.5,
                                repeat: Infinity,
                                ease: "easeInOut"
                            }}
                            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                        />
                    </div>
                </motion.div>
            </div>
        </div>
    );
}

export function LoadingSpinner() {
    return (
        <div className="flex items-center justify-center p-4">
            <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-6 h-6 border-t-2 border-white/20 border-r-2 border-white rounded-full"
            />
        </div>
    );
}
