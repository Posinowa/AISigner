// #91: Paylaşılan markdown gösterim bileşeni.
// Proje açıklamaları (admin formunda "Markdown" olarak isteniyor) ve AI chat
// yanıtları markdown içeriyor; ham `##`/`**` işaretleri yerine biçimlendirilmiş
// gösterilir. Tailwind typography plugin'ine bağımlı olmamak için element'ler
// tasarım sistemi (slate/blue) paletiyle elle eşlenir.

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

type Props = {
  children: string;
  className?: string;
};

const components: Components = {
  h1: ({ children }) => <h1 className="text-lg font-bold text-slate-900 mt-4 mb-2 first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="text-base font-bold text-slate-900 mt-4 mb-2 first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-semibold text-slate-800 mt-3 mb-1.5 first:mt-0">{children}</h3>,
  p: ({ children }) => <p className="text-sm text-slate-700 leading-relaxed my-2 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-5 my-2 space-y-1 text-sm text-slate-700">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 my-2 space-y-1 text-sm text-slate-700">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 hover:text-blue-700 underline underline-offset-2"
    >
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 text-[0.85em] font-mono">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="my-2 p-3 rounded-lg bg-slate-900 text-slate-100 text-xs font-mono overflow-x-auto">{children}</pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-3 border-slate-300 pl-3 my-2 text-slate-600 italic">{children}</blockquote>
  ),
  hr: () => <hr className="my-3 border-slate-200" />,
};

export function MarkdownContent({ children, className = "" }: Props) {
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
