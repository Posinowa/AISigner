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
  compact?: boolean;
};

export function MarkdownContent({ children, className = "", compact = false }: Props) {
  const components: Components = {
    h1: ({ children }) => <h1 className={`font-bold text-slate-900 dark:text-slate-100 first:mt-0 ${compact ? "text-base mt-2 mb-1" : "text-lg mt-4 mb-2"}`}>{children}</h1>,
    h2: ({ children }) => <h2 className={`font-bold text-slate-900 dark:text-slate-100 first:mt-0 ${compact ? "text-sm mt-2 mb-1" : "text-base mt-4 mb-2"}`}>{children}</h2>,
    h3: ({ children }) => <h3 className={`font-semibold text-slate-800 dark:text-slate-200 first:mt-0 ${compact ? "text-xs mt-1.5 mb-1" : "text-sm mt-3 mb-1.5"}`}>{children}</h3>,
    p: ({ children }) => <p className={`text-slate-700 dark:text-slate-200 leading-relaxed first:mt-0 last:mb-0 ${compact ? "text-xs my-1" : "text-sm my-2"}`}>{children}</p>,
    ul: ({ children }) => <ul className={`list-disc space-y-0.5 text-slate-700 dark:text-slate-200 ${compact ? "text-xs pl-4 my-1" : "text-sm pl-5 my-2 space-y-1"}`}>{children}</ul>,
    ol: ({ children }) => <ol className={`list-decimal space-y-0.5 text-slate-700 dark:text-slate-200 ${compact ? "text-xs pl-4 my-1" : "text-sm pl-5 my-2 space-y-1"}`}>{children}</ol>,
    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
    strong: ({ children }) => <strong className="font-semibold text-slate-900 dark:text-slate-100">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    a: ({ href, children }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline underline-offset-2"
      >
        {children}
      </a>
    ),
    code: ({ children }) => (
      <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-[0.85em] font-mono">{children}</code>
    ),
    pre: ({ children }) => (
      <pre className={`rounded-lg bg-slate-900 text-slate-100 font-mono overflow-x-auto ${compact ? "my-1 p-2 text-[11px]" : "my-2 p-3 text-xs"}`}>{children}</pre>
    ),
    blockquote: ({ children }) => (
      <blockquote className={`border-l-3 border-slate-300 text-slate-600 dark:text-slate-300 italic ${compact ? "pl-2 my-1" : "pl-3 my-2"}`}>{children}</blockquote>
    ),
    hr: () => <hr className={`${compact ? "my-1.5" : "my-3"} border-slate-200 dark:border-slate-700`} />,
  };

  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
