import React from 'react';
import { ExternalLink, Github, Layers } from 'lucide-react';

const projects = [
  {
    title: 'Autonomous Meta-Agent CLI',
    description: 'Terminal-first cognitive assistant with multi-tier memory, real-time tool execution, and self-healing diagnostics.',
    tags: ['TypeScript', 'Node.js', 'AI Agent', 'ESM'],
    github: 'https://github.com',
    link: '#',
  },
  {
    title: 'Distributed Cloud Microservices',
    description: 'High-throughput event-driven microservices architecture with real-time stream synchronization and Redis caching.',
    tags: ['Next.js', 'React', 'Tailwind CSS', 'PostgreSQL'],
    github: 'https://github.com',
    link: '#',
  },
  {
    title: 'Interactive Real-Time Analytics Dashboard',
    description: 'Interactive analytics visualization platform with responsive glassmorphism UI and sub-millisecond metrics telemetry.',
    tags: ['React', 'TypeScript', 'Tailwind', 'Chart.js'],
    github: 'https://github.com',
    link: '#',
  },
];

export default function Projects() {
  return (
    <section id="projects" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="text-center mb-12">
        <h2 className="text-3xl sm:text-4xl font-bold text-white">Featured Projects</h2>
        <p className="mt-3 text-slate-400">A collection of systems, applications, and developer tools I have built.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {projects.map((p, idx) => (
          <div key={idx} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 flex flex-col justify-between hover:border-slate-700 hover:shadow-xl hover:shadow-indigo-500/5 transition-all">
            <div>
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4">
                <Layers className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">{p.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-4">{p.description}</p>
            </div>
            
            <div>
              <div className="flex flex-wrap gap-2 mb-6">
                {p.tags.map((tag, tIdx) => (
                  <span key={tIdx} className="px-2.5 py-1 rounded-md bg-slate-800 text-xs font-medium text-slate-300">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="flex items-center space-x-4 border-t border-slate-800/80 pt-4">
                <a href={p.github} className="text-slate-400 hover:text-white inline-flex items-center space-x-1 text-sm font-medium">
                  <Github className="w-4 h-4" />
                  <span>Code</span>
                </a>
                <a href={p.link} className="text-indigo-400 hover:text-indigo-300 inline-flex items-center space-x-1 text-sm font-medium">
                  <ExternalLink className="w-4 h-4" />
                  <span>Live Demo</span>
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}