'use client';

import { useAuth } from '@/hooks/use-auth';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Star, Heart, MessageSquareQuote, LayoutDashboard } from 'lucide-react';
import Link from 'next/link';

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

  const navRef = useRef<HTMLElement>(null);
  const lastScrollY = useRef(0);
  const [navHidden, setNavHidden] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      setNavHidden(currentY > lastScrollY.current && currentY > 80);
      lastScrollY.current = currentY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Navbar CTA — 3 states
  const NavCTA = () => {
    if (loading) return null;
    if (user) {
      return (
        <Link href="/inbox">
          <button className="hidden md:flex bg-black text-[#D4FF00] px-8 py-3 font-black uppercase tracking-widest rounded-full border-4 border-black hover:bg-[#D4FF00] hover:text-black transition-all items-center gap-2">
            <LayoutDashboard className="w-5 h-5" />
            Dashboard
          </button>
        </Link>
      );
    }
    return (
      <div className="hidden md:flex items-center gap-4">
        <button
          onClick={signInWithGoogle}
          className="font-black uppercase tracking-widest text-base px-6 py-2 rounded-full border-4 border-black bg-white hover:bg-black hover:text-white transition-all"
        >
          Log In
        </button>
        <button
          onClick={signInWithGoogle}
          className="bg-black text-white px-8 py-3 font-black uppercase tracking-widest rounded-full border-4 border-black hover:bg-[#FF80FF] hover:text-black transition-all"
        >
          Sign Up
        </button>
      </div>
    );
  };

  const MobileNavCTA = () => {
    if (loading) return null;
    if (user) {
      return (
        <Link href="/inbox">
          <button className="md:hidden bg-black text-[#D4FF00] px-5 py-2 font-black uppercase text-sm rounded-full border-4 border-black flex items-center gap-2">
            <LayoutDashboard className="w-4 h-4" />
            Dash
          </button>
        </Link>
      );
    }
    return (
      <button
        onClick={signInWithGoogle}
        className="md:hidden bg-black text-white px-5 py-2 font-black uppercase text-sm rounded-full border-4 border-black"
      >
        Sign Up
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-[#1C7BFF] text-black selection:bg-[#D4FF00] selection:text-black font-sans overflow-x-hidden">
      {/* Navigation */}
      <nav
        ref={navRef}
        className={`fixed top-0 left-0 right-0 z-50 px-6 py-4 bg-[#1C7BFF] border-b-4 border-black transition-transform duration-300 ease-in-out ${
          navHidden ? '-translate-y-full' : 'translate-y-0'
        }`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 text-2xl md:text-3xl font-black tracking-tighter uppercase"
          >
            <MessageSquareQuote className="w-8 h-8 md:w-9 md:h-9" />
            <span>Replied</span>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
            <NavCTA />
            <MobileNavCTA />
          </motion.div>
        </div>
      </nav>

      <main>
        {/* Hero Section — full viewport, everything visible without scrolling */}
        <section className="min-h-screen flex flex-col items-center justify-center text-center px-6 pt-20 pb-8 gap-6 md:gap-6">
          <motion.h1
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="text-[4rem] sm:text-[6rem] md:text-[10rem] lg:text-[12rem] font-black uppercase leading-[0.85] tracking-tighter"
          >
            CURATED <br />
            <span className="flex items-center justify-center gap-2 md:gap-8 mt-1">
              <Star className="w-10 h-10 sm:w-16 sm:h-16 md:w-24 md:h-24 text-[#D4FF00] fill-current flex-shrink-0" />
              SILENCE
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="max-w-2xl text-base sm:text-xl md:text-2xl font-bold uppercase leading-tight"
          >
            Share your link. Receive honest messages. Publish the responses that define you.
          </motion.p>

          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.4 }}
            onClick={signInWithGoogle}
            className="bg-black text-white text-lg sm:text-2xl md:text-3xl font-black uppercase px-8 md:px-12 py-4 md:py-5 flex items-center gap-4 hover:bg-[#FF80FF] hover:text-black border-4 border-black transition-all group shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[8px] hover:translate-y-[8px]"
          >
            Get Your Link
            <ArrowRight className="w-6 h-6 md:w-8 md:h-8 group-hover:translate-x-2 transition-transform" />
          </motion.button>
        </section>

        {/* Example Block - Visual Proof */}
        <section className="bg-[#D4FF00] border-y-4 border-black py-16 md:py-24 px-6 relative overflow-hidden">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-4xl md:text-8xl font-black uppercase tracking-tighter mb-12 md:mb-16 flex flex-wrap items-center gap-4 md:gap-8">
              <Heart className="w-12 h-12 md:w-20 md:h-20 text-black fill-current" /> ON THE SAME PAGE
            </h2>

            <div className="flex flex-col gap-6 md:gap-8 max-w-4xl mx-auto">
              <div className="bg-[#FF80FF] border-4 border-black p-6 md:p-10 rounded-3xl rounded-tl-none shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] md:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] text-xl md:text-4xl font-bold uppercase">
                "What's the one thing you've learned about leadership that no one tells you?"
              </div>
              <div className="bg-white border-4 border-black p-6 md:p-10 rounded-3xl rounded-br-none shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] md:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] text-xl md:text-4xl font-bold uppercase self-end max-w-3xl">
                <span className="text-xs md:text-sm tracking-[0.3em] opacity-40 block mb-4">Response_01</span>
                "True leadership isn't about having the answers. It's about being the person people trust enough to admit they don't have them either."
              </div>
            </div>
          </div>
        </section>

        {/* Features Blocks */}
        <section className="grid md:grid-cols-3 border-b-4 border-black">
          {[
            {
              title: "Private by Default",
              desc: "Every message lands in an encrypted sanctuary. No one sees anything until you decide it's worth the record.",
              bg: "bg-[#A7FFD3]",
              icon: "🔏"
            },
            {
              title: "Public by Choice",
              desc: "Only your replies become public. Curate a profile that reveals your values and best responses.",
              bg: "bg-[#1C7BFF]",
              icon: "👁️"
            },
            {
              title: "Just a Link",
              desc: "Zero friction for your audience—no apps, no accounts. Just your unique handle in your social bio.",
              bg: "bg-[#FF80FF]",
              icon: "🔗"
            }
          ].map((feature, i) => (
            <div key={i} className={`p-8 md:p-12 border-b-4 md:border-b-0 md:border-r-4 border-black last:border-r-0 last:border-b-0 ${feature.bg} flex flex-col items-start gap-4 md:gap-6`}>
              <span className="text-5xl md:text-6xl">{feature.icon}</span>
              <h3 className="text-3xl md:text-5xl font-black uppercase tracking-tighter">{feature.title}</h3>
              <p className="text-lg md:text-2xl font-bold uppercase leading-snug">{feature.desc}</p>
            </div>
          ))}
        </section>
      </main>

      {/* Footer & Marquee */}
      <footer className="bg-black text-white overflow-hidden">
        <div className="border-b-4 border-white/20 py-4 md:py-6 flex whitespace-nowrap overflow-hidden">
          <motion.div
            animate={{ x: [0, -2000] }}
            transition={{ repeat: Infinity, duration: 15, ease: "linear" }}
            className="flex gap-4 md:gap-8 text-2xl md:text-5xl font-black uppercase tracking-widest whitespace-nowrap"
          >
            {[...Array(15)].map((_, i) => (
              <span key={i} className="flex items-center gap-4 md:gap-8">
                GET REPLIED UPDATES IN YOUR INBOX <Star className="w-6 h-6 md:w-10 md:h-10 fill-[#D4FF00]" />
              </span>
            ))}
          </motion.div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-12 md:py-20 flex flex-col md:flex-row justify-between items-center gap-8 md:gap-12">
          <div className="flex items-center gap-4 text-3xl md:text-5xl font-black tracking-tighter uppercase text-white">
            <MessageSquareQuote className="w-10 h-10 md:w-14 md:h-14 text-[#D4FF00]" />
            <span>Replied</span>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-6 md:gap-12 text-lg md:text-2xl font-bold uppercase tracking-widest text-white/70">
            <a href="https://github.com/marvlock/replied" className="hover:text-[#D4FF00] transition-colors">GitHub</a>
            <a href="https://www.marvlock.dev/" className="hover:text-[#D4FF00] transition-colors">Marvlock</a>
            <span>© {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
