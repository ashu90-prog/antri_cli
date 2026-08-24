'use client';
import React, { useState } from 'react';
import { Code2, Menu, X } from 'lucide-react';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <Code2 className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-indigo-400">
              DevPortfolio
            </span>
          </div>
          
          <div className="hidden md:flex items-center space-x-8">
            <a href="#home" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Home</a>
            <a href="#about" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">About</a>
            <a href="#projects" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Projects</a>
            <a href="#skills" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Skills</a>
            <a href="#contact" className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium shadow-md shadow-indigo-600/30 transition-all">
              Contact Me
            </a>
          </div>

          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-slate-400 hover:text-white focus:outline-none"
            >
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="md:hidden bg-slate-900 border-b border-slate-800 px-4 pt-2 pb-4 space-y-2">
          <a href="#home" onClick={() => setIsOpen(false)} className="block py-2 text-slate-300 hover:text-white">Home</a>
          <a href="#about" onClick={() => setIsOpen(false)} className="block py-2 text-slate-300 hover:text-white">About</a>
          <a href="#projects" onClick={() => setIsOpen(false)} className="block py-2 text-slate-300 hover:text-white">Projects</a>
          <a href="#skills" onClick={() => setIsOpen(false)} className="block py-2 text-slate-300 hover:text-white">Skills</a>
          <a href="#contact" onClick={() => setIsOpen(false)} className="block py-2 text-indigo-400 font-semibold">Contact</a>
        </div>
      )}
    </nav>
  );
}