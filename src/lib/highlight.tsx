// Tiny regex-based syntax highlighter (no external dependency).
// Produces React spans; good enough for reading analyzed source code.

import type { ReactNode } from 'react';

const KEYWORDS: Record<string, string[]> = {
  common: [
    'import', 'from', 'export', 'return', 'if', 'else', 'for', 'while', 'class', 'extends',
    'new', 'try', 'catch', 'finally', 'throw', 'const', 'let', 'var', 'function', 'async',
    'await', 'def', 'elif', 'lambda', 'pass', 'None', 'True', 'False', 'null', 'undefined',
    'this', 'self', 'in', 'not', 'and', 'or', 'is', 'with', 'as', 'yield', 'type', 'interface',
    'implements', 'public', 'private', 'static', 'void', 'package', 'struct', 'fn', 'match',
    'use', 'mod', 'pub', 'impl', 'where', 'echo', 'fn', 'then', 'fi', 'do', 'done', 'case', 'esac',
  ],
};

const TOKEN_RE = new RegExp(
  [
    /(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/)/.source, // 1 comment
    /("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)/.source, // 2 string
    /\b(\d[\d_]*(?:\.\d+)?)\b/.source, // 3 number
    /\b([A-Za-z_$][\w$]*)\b/.source, // 4 identifier/keyword
  ].join('|'),
  'g',
);

export function highlightCode(code: string, language: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  const push = (text: string, cls?: string) => {
    if (!text) return;
    out.push(cls ? (
      <span key={key++} className={cls}>{text}</span>
    ) : (
      <span key={key++}>{text}</span>
    ));
  };
  TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(code))) {
    push(code.slice(last, m.index));
    if (m[1]) push(m[1], 'text-muted-foreground italic');
    else if (m[2]) push(m[2], 'text-emerald-600 dark:text-emerald-400');
    else if (m[3]) push(m[3], 'text-orange-600 dark:text-orange-400');
    else if (m[4]) {
      const w = m[4];
      if (KEYWORDS.common.includes(w)) push(w, 'text-violet-600 dark:text-violet-400 font-medium');
      else if (/^[A-Z]/.test(w)) push(w, 'text-sky-600 dark:text-sky-400');
      else push(w);
    }
    last = m.index + m[0].length;
  }
  push(code.slice(last));
  void language;
  return out;
}
