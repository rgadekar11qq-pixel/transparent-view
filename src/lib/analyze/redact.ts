// Best-effort secret redaction. Applied to every snippet that is shown in the
// UI or exported. This is NOT perfect — it is a safety net, not a guarantee.

const PATTERNS: { re: RegExp; replacement: string }[] = [
  // assignment-style secrets: password = "...", api_key: '...', etc.
  {
    re: /((?:password|passwd|pwd|secret|api[_-]?key|apikey|access[_-]?token|auth[_-]?token|refresh[_-]?token|client[_-]?secret|private[_-]?key|session[_-]?secret)\s*[:=]\s*)(["']?)[^\s"'\n]{4,}\2/gi,
    replacement: '$1$2<REDACTED>$2',
  },
  // AWS access key ids
  { re: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/g, replacement: '<REDACTED_AWS_KEY>' },
  // generic long tokens (40+ chars of token-ish alphabet)
  {
    re: /\b([A-Za-z0-9_\-]{8,}\.)?[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{8,}\b/g,
    replacement: '<REDACTED_TOKEN>',
  },
  // credentials inside URLs: user:pass@host or scheme://...@ or ...//host?key=...
  {
    re: /(\w+:\/\/[^/\s:]+:)[^@\s/]+@/g,
    replacement: '$1<REDACTED>@',
  },
  {
    re: /((?:postgres|postgresql|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/)([^@/\s]+)@/gi,
    replacement: '$1<REDACTED>@',
  },
  // Bearer / token headers
  { re: /\b(Bearer\s+)[A-Za-z0-9_\-\.]{10,}/gi, replacement: '$1<REDACTED>' },
  // openai/sk-like keys
  { re: /\bsk-[A-Za-z0-9]{10,}\b/g, replacement: '<REDACTED_KEY>' },
];

export function redactSecrets(text: string): string {
  let out = text;
  for (const { re, replacement } of PATTERNS) {
    out = out.replace(re, replacement);
  }
  return out;
}

/** Extract the env-var names referenced by code, without their values. */
export function extractEnvVarNames(content: string): string[] {
  const names = new Set<string>();
  const res = [
    /process\.env\.([A-Z_][A-Z0-9_]*)/g,
    /process\.env\[\s*["']([A-Z_][A-Z0-9_]*)["']\s*\]/g,
    /import\.meta\.env\.([A-Z_][A-Z0-9_]*)/g,
    /os\.getenv\(\s*["']([A-Z_][A-Z0-9_]*)["']/g,
    /os\.environ(?:\.get)?\(\s*["']([A-Z_][A-Z0-9_]*)["']/g,
    /os\.environ\[\s*["']([A-Z_][A-Z0-9_]*)["']\s*\]/g,
    /^\s*([A-Z_][A-Z0-9_]*)\s*=/gm,
  ];
  for (const re of res) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(content))) names.add(m[1]);
  }
  return [...names];
}
