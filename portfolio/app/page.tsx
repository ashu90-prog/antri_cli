import React from 'react';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import Projects from '../components/Projects';
import Skills from '../components/Skills';
import Contact from '../components/Contact';

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950">
      <Navbar />
      <Hero />
      <Projects />
      <Skills />
      <Contact />
      <footer className="border-t border-slate-900 py-8 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} Developer Portfolio. Built with Next.js, React, & Tailwind CSS.
      </footer>
    </main>
  );
}