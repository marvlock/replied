'use client';

import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { MessageSquare, ArrowRight, Shield, Globe } from 'lucide-react';

export default function Home() {
  const { user, signInWithGoogle, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && !loading) {
      router.push('/inbox');
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen bg-black text-white selection:bg-primary/30 overflow-hidden">
      {/* Background Decor */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-stone-900/40 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/5 blur-[120px] rounded-full" />
      </div>

      <nav className="relative z-10 flex items-center justify-between px-6 py-8 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-black" />
          </div>
          <span className="font-bold tracking-tighter text-xl">Replied</span>
        </div>
        <Button
          variant="ghost"
          onClick={signInWithGoogle}
          className="text-stone-400 hover:text-white hover:bg-stone-900 rounded-full px-6"
        >
          Sign In
        </Button>
      </nav>

      <main className="relative z-10 max-w-5xl mx-auto px-6 pt-20 pb-32 flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="space-y-8"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-stone-900/50 border border-stone-800 text-stone-400 text-[10px] uppercase tracking-[0.2em] mb-4">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/40 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Private Inbox • Public Record
          </div>

          <h1 className="text-6xl md:text-8xl font-bold tracking-tighter leading-[0.9] text-transparent bg-clip-text bg-gradient-to-b from-white to-stone-500">
            You are what you <br /> choose to respond to.
          </h1>

          <p className="max-w-2xl mx-auto text-xl text-stone-400 leading-relaxed font-light">
            An anonymous messaging platform where your public profile is a living, curated record
            of the conversations you found worth having.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
            <Button
              size="lg"
              onClick={signInWithGoogle}
              className="bg-white text-black hover:bg-stone-200 h-14 px-10 rounded-full font-bold text-lg shadow-2xl shadow-white/10 active:scale-95 transition-all"
            >
              Get Your Link
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </motion.div>

        {/* Feature Grid */}
        <section className="grid md:grid-cols-3 gap-8 mt-40 text-left">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="p-8 rounded-3xl bg-stone-900/20 border border-stone-800/50 space-y-4"
          >
            <Shield className="w-8 h-8 text-stone-500" />
            <h3 className="text-xl font-bold tracking-tight">Private Inbox</h3>
            <p className="text-stone-500 leading-relaxed">
              Anonymous messages land in your private inbox. Nothing is public until you decide.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="p-8 rounded-3xl bg-stone-900/20 border border-stone-800/50 space-y-4 shadow-2xl shadow-primary/5"
          >
            <MessageSquare className="w-8 h-8 text-white" />
            <h3 className="text-xl font-bold tracking-tight">Curated Feed</h3>
            <p className="text-stone-500 leading-relaxed">
              Every reply publishes the pair to your profile. Reveal your values through engagement.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="p-8 rounded-3xl bg-stone-900/20 border border-stone-800/50 space-y-4"
          >
            <Globe className="w-8 h-8 text-stone-500" />
            <h3 className="text-xl font-bold tracking-tight">No Accounts Needed</h3>
            <p className="text-stone-500 leading-relaxed">
              Anyone can visit your link and send a message. Zero friction for your audience.
            </p>
          </motion.div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-stone-900 mt-20 py-12 text-center">
        <p className="text-stone-600 text-sm font-mono uppercase tracking-widest">
          The future of social is curated.
        </p>
      </footer>
    </div>
  );
}
