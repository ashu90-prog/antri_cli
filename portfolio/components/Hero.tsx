import React from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';

export default function Hero() {
  return (
    <section id="home" className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col items-center text-center">
      <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 text-xs font-medium mb-6">
        <Sparkles className="w-4 h-4" />
        <span>Available for Full-Stack & Systems Engineering</span>
      </div>

      <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white max-w-4xl">
        Building modern, scalable software with <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400">precision & speed</span>.
      </h1>

      <p className="mt-6 text-lg sm:text-xl text-slate-400 max-w-2xl">
        Full-Stack Software Engineer specializing in React, Next.js, TypeScript, Node.js, and Distributed Cloud Architecture.
      </p>

      <div className="mt-8 flex flex-wrap gap-4 justify-center">
        <a
          href="#projects"
          className="inline-flex items-center space-x-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-semibold shadow-lg shadow-indigo-500/25 transition-all"
        >
          <span>View Projects</span>
          <ArrowRight className="w-4 h-4" />
        </a>
        <a
          href="#contact"
          className="inline-flex items-center space-x-2 px-6 py-3 rounded-xl border border-slate-700 hover:border-slate-600 bg-slate-900/50 hover:bg-slate-800 text-slate-200 font-semibold transition-all"
        >
          <span>Get in Touch</span>
        </a>
      </div>
    </section>
  );
}