import React from 'react';
import { Cpu, Globe, Database, Terminal } from 'lucide-react';

const skillCategories = [
  {
    icon: <Globe className="w-6 h-6 text-cyan-400" />,
    title: 'Frontend & UI',
    skills: ['React', 'Next.js', 'TypeScript', 'Tailwind CSS', 'Framer Motion', 'Redux / Zustand'],
  },
  {
    icon: <Cpu className="w-6 h-6 text-indigo-400" />,
    title: 'Backend & APIs',
    skills: ['Node.js', 'Express', 'Python', 'FastAPI', 'GraphQL', 'RESTful Systems'],
  },
  {
    icon: <Database className="w-6 h-6 text-emerald-400" />,
    title: 'Databases & Storage',
    skills: ['PostgreSQL', 'SQLite', 'MongoDB', 'Redis', 'Vector Embeddings', 'Prisma / Drizzle'],
  },
  {
    icon: <Terminal className="w-6 h-6 text-purple-400" />,
    title: 'DevOps & Tooling',
    skills: ['Docker', 'Git & GitHub', 'CI/CD Pipelines', 'Linux', 'Vercel', 'AWS'],
  },
];

export default function Skills() {
  return (
    <section id="skills" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto bg-slate-900/30 rounded-3xl border border-slate-800/60 my-12">
      <div className="text-center mb-12">
        <h2 className="text-3xl sm:text-4xl font-bold text-white">Technical Skills & Expertise</h2>
        <p className="mt-3 text-slate-400">Core technologies, frameworks, and architecture paradigms I leverage.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {skillCategories.map((cat, idx) => (
          <div key={idx} className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-5">
            <div className="mb-4">{cat.icon}</div>
            <h3 className="font-semibold text-lg text-white mb-3">{cat.title}</h3>
            <ul className="space-y-2">
              {cat.skills.map((s, sIdx) => (
                <li key={sIdx} className="text-sm text-slate-300 flex items-center space-x-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}