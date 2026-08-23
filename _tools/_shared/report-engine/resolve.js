/* =============================================================
   TheRacingData — shared report engine
   Safe tag resolver for docx-templates.

   docx-templates evaluates every tag as JavaScript. Its browser
   build does that by creating an <iframe> per tag, which is slow
   and needs a document; its `noSandbox` mode uses new Function(),
   which would force 'unsafe-eval' into the page's CSP.

   Our templates only ever need a dotted path and the occasional
   +N on the loop index, so neither is necessary. This resolver
   understands exactly that grammar and nothing else, which keeps
   the page CSP-clean and means a template can never execute code.

       name              a.b.c            $o.corner
       $idx+1            $idx-1

   Anything else throws, and the validator reports it against the
   template rather than letting it fail silently at export time.
   ============================================================= */

const PATH = /^\$?[A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*)*$/;
const OFFSET = /^(\$?[A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*)*)\s*([+-])\s*(\d+)$/;

export class UnsupportedExpression extends Error {
  constructor(code) {
    super(`Unsupported template expression: "${code}"`);
    this.code = code;
  }
}

function lookup(scope, path) {
  let value = scope;
  for (const key of path.split('.')) {
    if (value == null) return undefined;
    value = value[key];
  }
  return value;
}

export function evaluate(code, scope) {
  const src = String(code).trim();

  if (PATH.test(src)) return lookup(scope, src);

  const offset = OFFSET.exec(src);
  if (offset) {
    const base = Number(lookup(scope, offset[1]));
    if (!Number.isFinite(base)) return undefined;
    return offset[2] === '+'
      ? base + Number(offset[3])
      : base - Number(offset[3]);
  }

  throw new UnsupportedExpression(src);
}

/* Slots into createReport({ runJs }). docx-templates hands us the
   assembled scope on `sandbox` with the code at __code__. */
export function runJs({ sandbox }) {
  return { modifiedSandbox: sandbox, result: evaluate(sandbox.__code__, sandbox) };
}
