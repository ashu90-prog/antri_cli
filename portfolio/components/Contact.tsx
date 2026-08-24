import React from 'react';
import { Mail, Github, Linkedin } from 'lucide-react';

export default function Contact() {
  return (
    <section id="contact" className="py-20 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto text-center">
      <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Let's Build Something Great</h2>
      <p className="text-slate-400 mb-8">
        Whether you have an upcoming project, architectural challenge, or collaboration in mind, feel free to reach out.
      </p>

      <div className="inline-flex items-center space-x-3 px-6 py-4 rounded-2xl bg-indigo-600/10 border border-indigo-500/30 text-indigo-300 font-medium mb-8">
        <Mail className="w-5 h-5 text-indigo-400" />
        <span>contact@example.com</span>
      </div>

      <div className="flex justify-center space-x-6">
        <a href="https://github.com" className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300 hover:text-white hover:border-slate-700 transition-all">
          <Github className="w-6 h-6" />
        </a>
        <a href="https://linkedin.com" className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300 hover:text-white hover:border-slate-700 transition-all">
          <Linkedin className="w-6 h-6" />
        </a>
      </div>
    </section>
  );
}