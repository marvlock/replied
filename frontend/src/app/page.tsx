'use client';

import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { MessageSquare, ArrowRight } from 'lucide-react';
import Image from 'next/image';

export default function Home() {
  const { user, hasUsername, signInWithGoogle, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && !loading && hasUsername !== null) {
      if (hasUsername) {
        router.push('/inbox');
      } else {
        router.push('/setup');
      }
    }
  }, [user, loading, hasUsername, router]);


  return (
    <div className="min-h-screen text-white selection:bg-white/30 overflow-x-hidden pt-20 transition-colors duration-500">
      {/* Background Layer */}
      <div className="fixed inset-0 -z-20 bg-black" />

      {/* Hero Fullscreen Background */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <Image
          src="/paint.jpeg"
          alt="Background"
          fill
          priority
          className="object-cover object-center transition-opacity duration-1000 scale-105"
        />
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black" />
      </div>

      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 backdrop-blur-xl border-b border-white/5 bg-black/40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2.5 group cursor-pointer"
          >
            <div className="w-9 h-9 bg-white text-black rounded-xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-300">
              <MessageSquare className="w-5 h-5 fill-current" />
            </div>
            <span className="font-extrabold tracking-tighter text-2xl bg-clip-text text-transparent bg-gradient-to-r from-white to-stone-400">Replied</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <Button
              variant="ghost"
              onClick={signInWithGoogle}
              className="text-stone-400 hover:text-white hover:bg-white/5 rounded-xl px-6 font-medium transition-all"
            >
              Log in
            </Button>
          </motion.div>
        </div>
      </nav>

      <main className="relative z-10 max-w-7xl mx-auto px-6 flex flex-col items-center">
        {/* Hero Section */}
        <div className="pt-24 pb-32 text-center relative max-w-4xl w-full">
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-6xl md:text-[11rem] font-bold tracking-tighter leading-[0.9] md:leading-[0.8] mb-12 drop-shadow-2xl"
          >
            Curated <br />
            <span className="text-stone-300 italic font-serif opacity-90 shadow-white/5">Silence</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.4 }}
            className="max-w-2xl mx-auto text-xl md:text-2xl text-stone-200 leading-relaxed font-serif italic mb-16 drop-shadow-lg"
          >
            The anonymous sanctuary for professional curation. <br />
            Share your link, receive honest messages, and publish the responses that define you.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-6"
          >
            <Button
              size="lg"
              onClick={signInWithGoogle}
              className="group relative overflow-hidden bg-white text-black hover:bg-stone-200 h-16 px-10 rounded-2xl font-bold text-xl shadow-[0_0_40px_-5px_rgba(255,255,255,0.3)] hover:shadow-[0_0_60px_-5px_rgba(255,255,255,0.4)] transition-all active:scale-95 text-center flex items-center justify-center"
            >
              Get Your Link
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </motion.div>
        </div>

        {/* Visual Proof / Mockup */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
          className="w-full max-w-4xl mt-12 mb-40 relative group"
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent z-10 pointer-events-none" />
          <div className="bg-white/[0.03] border border-white/10 rounded-[2.5rem] md:rounded-[3rem] p-6 md:p-16 backdrop-blur-md overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)]">
            <div className="flex flex-col gap-10 scale-95 md:scale-100 origin-top">
              {/* Question */}
              <div className="max-w-[95%] md:max-w-[85%] p-6 md:p-8 rounded-2xl md:rounded-3xl rounded-tl-none bg-black/60 border border-white/5 text-stone-200 font-serif italic text-lg md:text-2xl shadow-2xl leading-relaxed">
                "What's the one thing you've learned about leadership that no one tells you?"
              </div>
              {/* Reply */}
              <div className="max-w-[95%] md:max-w-[85%] self-end p-8 md:p-10 rounded-[2rem] md:rounded-[2.5rem] rounded-br-none bg-white text-black leading-relaxed shadow-[0_20px_60px_rgba(255,255,255,0.1)]">
                <p className="font-mono text-[9px] md:text-[10px] uppercase tracking-[0.3em] mb-4 opacity-50">Response_01</p>
                <div className="text-lg md:text-2xl font-serif italic tracking-tight">
                  "True leadership isn't about having the answers. It's about being the person people trust enough to admit they don't have them either."
                </div>
              </div>
            </div>
          </div>
          {/* Decorative Elements */}
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 blur-[80px] rounded-full group-hover:bg-white/10 transition-colors duration-700" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-stone-500/10 blur-[80px] rounded-full" />
        </motion.div>

        {/* Feature Section */}
        <div className="w-full grid md:grid-cols-3 gap-12 pb-40 border-t border-stone-900 pt-20">
          {[
            {
              title: "Private by Default",
              desc: "Every message lands in a encrypted sanctuary. No one sees anything until you decide it's worth the record."
            },
            {
              title: "Public by Choice",
              desc: "Only your replies become public. Curate a profile that reveals your values and best responses."
            },
            {
              title: "Just a Link",
              desc: "Zero friction for your audience—no apps, no accounts. Just your unique handle in your social bio."
            }
          ].map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="space-y-6 p-8 rounded-3xl bg-white/[0.02] border border-white/5 backdrop-blur-sm hover:bg-white/[0.04] transition-colors group/card"
            >
              <div className="h-px w-10 bg-white/20 group-hover/card:w-20 transition-all duration-500" />
              <h3 className="text-2xl font-serif italic tracking-tight text-white">{feature.title}</h3>
              <p className="text-stone-300 leading-relaxed text-base font-light opacity-80">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </main>

      <footer className="w-full py-20 bg-stone-950 border-t border-stone-900 mt-20 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 flex flex-col items-center">
          <div className="flex items-center gap-2.5 mb-8 opacity-50 grayscale hover:grayscale-0 transition-all cursor-pointer">
            <div className="w-7 h-7 bg-white text-black rounded-lg flex items-center justify-center">
              <MessageSquare className="w-4 h-4 fill-current" />
            </div>
            <span className="font-bold tracking-tighter text-lg">Replied</span>
          </div>
          <p className="text-stone-600 text-[10px] font-mono uppercase tracking-[0.4em] mb-4">
            Forging connections through curation
          </p>
          <div className="flex flex-col items-center gap-6">
            <div className="flex gap-8 text-stone-600 text-[10px] font-mono uppercase tracking-[0.2em]">
              <a href="https://github.com/marvlock/replied" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">GitHub (Open Source)</a>
              <a href="https://www.marvlock.dev/" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">By Marvlock</a>
            </div>
            <p className="text-stone-800 text-[9px] font-mono uppercase tracking-[0.5em]">
              © {new Date().getFullYear()} REPLIED
            </p>
          </div>
        </div>
        {/* Abstract pattern floor */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-stone-800 to-transparent shadow-[0_0_100px_rgba(255,255,255,0.05)]" />
      </footer>
    </div>
  );
}
