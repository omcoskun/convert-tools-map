// A small XML reader for the GPX and KML files dropped on the map: elements,
// attributes, text, CDATA and the five entities with numeric references.
// Comments, processing instructions and a doctype (with any internal subset,
// whose entities are not expanded) are skipped. It never fetches anything.
// A malformed document throws an Error whose message starts with "XML".

const ENTITIES = Object.freeze({ lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" });
const NAME = /^[A-Za-z_][\w.:-]*/;
const ATTRIBUTE = /\s+([A-Za-z_][\w.:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/y;

function decode(value) {
  return value.replace(/&(#[xX][0-9a-fA-F]+|#\d+|[A-Za-z]+);/g, (whole, name) => {
    if (name[0] !== "#") return ENTITIES[name] ?? whole;
    const point = name[1] === "x" || name[1] === "X" ? Number.parseInt(name.slice(2), 16) : Number.parseInt(name.slice(1), 10);
    return Number.isInteger(point) && point <= 0x10ffff ? String.fromCodePoint(point) : whole;
  });
}

function fail(why) {
  throw new Error(`XML: ${why}`);
}

/** The index of the ">" that ends the tag opened at `open`, outside quoted values. */
function tagEnd(source, open) {
  let quote = null;
  for (let index = open + 1; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === ">") {
      return index;
    }
  }
  return fail("unclosed tag");
}

/**
 * @typedef {{ name: string, local: string, attrs: Record<string, string>, children: XmlElement[], parts: (string | XmlElement)[] }} XmlElement
 *   local is the name without its namespace prefix ("gx:Track" -> "Track");
 *   parts are the text and child elements in document order.
 */

/** @returns {XmlElement} the root element */
export function parseXml(source) {
  const doc = String(source);
  const stack = [];
  let root = null;
  let index = 0;
  while (index < doc.length) {
    const open = doc.indexOf("<", index);
    const end = open < 0 ? doc.length : open;
    if (end > index) {
      const chunk = doc.slice(index, end);
      if (stack.length > 0) stack[stack.length - 1].parts.push(decode(chunk));
      else if (chunk.trim() !== "") fail("text outside the root element");
    }
    if (open < 0) break;
    if (doc.startsWith("<!--", open)) {
      const close = doc.indexOf("-->", open + 4);
      if (close < 0) fail("unclosed comment");
      index = close + 3;
      continue;
    }
    if (doc.startsWith("<![CDATA[", open)) {
      const close = doc.indexOf("]]>", open + 9);
      if (close < 0 || stack.length === 0) fail("misplaced CDATA");
      stack[stack.length - 1].parts.push(doc.slice(open + 9, close));
      index = close + 3;
      continue;
    }
    if (doc.startsWith("<?", open)) {
      const close = doc.indexOf("?>", open + 2);
      if (close < 0) fail("unclosed processing instruction");
      index = close + 2;
      continue;
    }
    if (doc.startsWith("<!", open)) {
      let depth = 0;
      let at = open + 2;
      for (; at < doc.length; at += 1) {
        const char = doc[at];
        if (char === "[") depth += 1;
        else if (char === "]") depth -= 1;
        else if (char === ">" && depth <= 0) break;
      }
      if (at >= doc.length) fail("unclosed declaration");
      index = at + 1;
      continue;
    }
    const close = tagEnd(doc, open);
    let inner = doc.slice(open + 1, close);
    index = close + 1;
    if (inner.startsWith("/")) {
      const name = inner.slice(1).trim();
      const element = stack.pop();
      if (!element || element.name !== name) fail(`</${name}> closes nothing open`);
      continue;
    }
    const selfClosing = inner.endsWith("/");
    if (selfClosing) inner = inner.slice(0, -1);
    const name = NAME.exec(inner)?.[0];
    if (!name) fail("a tag without a name");
    const element = { name, local: name.slice(name.indexOf(":") + 1), attrs: {}, children: [], parts: [] };
    let at = name.length;
    ATTRIBUTE.lastIndex = at;
    for (let match = ATTRIBUTE.exec(inner); match; match = ATTRIBUTE.exec(inner)) {
      element.attrs[match[1]] = decode(match[2] ?? match[3]);
      at = ATTRIBUTE.lastIndex;
    }
    if (inner.slice(at).trim() !== "") fail(`bad attributes in <${name}>`);
    if (stack.length > 0) {
      const parent = stack[stack.length - 1];
      parent.children.push(element);
      parent.parts.push(element);
    } else if (root) {
      fail("a second root element");
    } else {
      root = element;
    }
    if (!selfClosing) stack.push(element);
  }
  if (stack.length > 0) fail(`<${stack[stack.length - 1].name}> is not closed`);
  if (!root) fail("no element");
  return root;
}

/** The child elements with this local name. */
export function childrenOf(element, local) {
  return element ? element.children.filter((child) => child.local === local) : [];
}

/** The first child element with this local name, or null. */
export function firstChild(element, local) {
  return element?.children.find((child) => child.local === local) ?? null;
}

/** Every element inside `element` with this local name, in document order. */
export function descendantsOf(element, local) {
  const found = [];
  const walk = (node) => {
    for (const child of node.children) {
      if (child.local === local) found.push(child);
      walk(child);
    }
  };
  if (element) walk(element);
  return found;
}

/** The text of the element and everything inside it. */
export function textOf(element) {
  if (!element) return "";
  return element.parts.map((part) => (typeof part === "string" ? part : textOf(part))).join("");
}
