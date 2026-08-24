import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Full-Stack Developer Portfolio',
  description: 'Modern Portfolio built with Next.js, React, & Tailwind CSS',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="bg-slate-950 text-slate-100 min-h-screen antialiased selection:bg-indigo-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}