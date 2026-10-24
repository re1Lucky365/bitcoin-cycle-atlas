// Find literal module URLs without executing application code. Syntax is checked
// separately by node --check; this scanner only separates code from source text.
const identifier = /[$_\p{ID_Start}][$_\p{ID_Continue}\u200c\u200d]*/uy;
const expressionKeywords = new Set(['return', 'throw', 'case', 'delete', 'void', 'typeof', 'new', 'in', 'instanceof', 'yield', 'await', 'else', 'do']);
const controlKeywords = new Set(['if', 'while', 'for', 'with', 'switch', 'catch']);
const backtick = String.fromCharCode(96);

function codeTokens(source) {
  const tokens = [];
  let position = source.startsWith('#!') ? source.indexOf('\n') : 0;
  if (position < 0) return tokens;
  const add = (type, value) => tokens.push({type, value});
  function string(quote) {
    const start = position++;
    while (position < source.length) {
      const character = source[position++];
      if (character === '\\') position += source[position] === '\r' && source[position + 1] === '\n' ? 2 : 1;
      else if (character === quote) break;
    }
    tokens.push({type:'string', value:source.slice(start, position), start, end:position});
  }
  function template() {
    position++;
    add('literal', 'template');
    while (position < source.length) {
      if (source[position] === '\\') {position += 2;continue;}
      if (source[position] === backtick) {position++;break;}
      if (source[position] === '$' && source[position + 1] === '{') {
        position += 2;code(true);add('literal', 'template');
      } else position++;
    }
  }
  function regularExpression() {
    position++;
    let inClass = false;
    while (position < source.length) {
      const character = source[position++];
      if (character === '\\') position++;
      else if (character === '[') inClass = true;
      else if (character === ']') inClass = false;
      else if (character === '/' && !inClass) break;
    }
    while (/[a-z]/i.test(source[position] || '') && position < source.length) position++;
    add('literal', 'regexp');
  }
  function code(interpolation = false) {
    let expression = true;
    let functionHeader = null;
    const delimiters = [], classHeaders = [];
    function declarationIsExpression() {
      let previous = tokens.at(-1);
      if (previous?.value === 'async') previous = tokens.at(-2);
      return previous && (['=', '(', '[', ',', ':', '?', '=>'].includes(previous.value) ||
        expressionKeywords.has(previous.value) || previous.value === 'extends');
    }
    while (position < source.length) {
      const character = source[position], next = source[position + 1];
      if (/\s/.test(character)) {position++;continue;}
      if (character === '/' && next === '/') {
        position += 2;while (position < source.length && !/[\r\n\u2028\u2029]/.test(source[position])) position++;
        continue;
      }
      if (character === '/' && next === '*') {
        const end = source.indexOf('*/', position + 2);position = end < 0 ? source.length : end + 2;continue;
      }
      if (character === "'" || character === '"') {string(character);expression = false;continue;}
      if (character === backtick) {template();expression = false;continue;}
      if (character === '/' && expression) {regularExpression();expression = false;continue;}
      identifier.lastIndex = position;
      const word = identifier.exec(source);
      if (word) {
        if (!['.', '?.'].includes(tokens.at(-1)?.value)) {
          if (word[0] === 'function') functionHeader = {expression:Boolean(declarationIsExpression())};
          if (word[0] === 'class') classHeaders.push({depth:delimiters.length, expression:Boolean(declarationIsExpression())});
        }
        position = identifier.lastIndex;add('word', word[0]);expression = expressionKeywords.has(word[0]);continue;
      }
      if (/\d/.test(character)) {
        position++;while (position < source.length && /[\w.]/.test(source[position])) position++;
        add('literal', 'number');expression = false;continue;
      }
      const previous = tokens.at(-1);
      if (character === '}' && interpolation && delimiters.length === 0) {position++;return;}
      let value = character;
      if (['?.', '=>', '++', '--'].includes(character + next)) value += next;
      position += value.length;add('punctuation', value);
      if (value === '(') {
        delimiters.push({kind:'(', control:controlKeywords.has(previous?.value), functionHeader});
        functionHeader = null;
        expression = true;
      } else if (value === '[') {
        delimiters.push({kind:'['});expression = true;
      } else if (value === '{') {
        let block = !previous || previous.value === ')' ||
          previous.value === ';' || previous.value === '{' || previous.value === '}' ||
          ['else', 'do', 'try', 'finally'].includes(previous.value);
        if (previous?.functionHeader) block = !previous.functionHeader.expression;
        if (classHeaders.at(-1)?.depth === delimiters.length) block = !classHeaders.pop().expression;
        delimiters.push({kind:'{', block});expression = true;
      } else if (value === ')' || value === ']' || value === '}') {
        const opening = delimiters.pop();
        if (value === ')' && opening?.functionHeader) tokens.at(-1).functionHeader = opening.functionHeader;
        expression = value === ')' ? Boolean(opening?.control) : value === '}' && Boolean(opening?.block);
      } else expression = !['.', '?.', '++', '--'].includes(value);
    }
  }
  code();
  return tokens;
}

function stringValue(token) {
  // Module specifiers may use JS escapes, unlike JSON. Decode only a complete
  // string token; never eval source or confuse its contents with more code.
  return token.value.slice(1, -1).replace(/\\(?:u\{([\da-f]+)\}|u([\da-f]{4})|x([\da-f]{2})|(\r\n|[\n\r\u2028\u2029])|([\s\S]))/gi,
    (_, point, unicode, hex, newline, character) => {
      if (point || unicode || hex) return String.fromCodePoint(parseInt(point || unicode || hex, 16));
      if (newline) return '';
      return ({'0':'\0', b:'\b', f:'\f', n:'\n', r:'\r', t:'\t', v:'\v'})[character] ?? character;
    });
}

export function javascriptModuleReferences(source) {
  const tokens = codeTokens(source), specifiers = [];
  function afterBraces(start) {
    let depth = 0;
    for (let index = start; index < tokens.length; index++) {
      if (tokens[index].type !== 'punctuation') continue;
      if (tokens[index].value === '{') depth++;
      if (tokens[index].value === '}' && --depth === 0) return index + 1;
    }
    return tokens.length;
  }
  const add = token => {
    if (token?.type === 'string') specifiers.push({specifier:stringValue(token), start:token.start, end:token.end});
  };
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index], previous = tokens[index - 1]?.value;
    if (token.type !== 'word' || !['import', 'export'].includes(token.value) || ['.', '?.'].includes(previous)) continue;
    let cursor = index + 1;
    if (token.value === 'import') {
      if (tokens[cursor]?.type === 'string') {add(tokens[cursor]);continue;}
      if (tokens[cursor]?.value === '(') {
        // Computed imports remain intentionally unresolved, as in the original
        // verifier. A literal argument may be followed by import attributes.
        if ([')', ','].includes(tokens[cursor + 2]?.value)) add(tokens[cursor + 1]);
        continue;
      }
      if (tokens[cursor]?.type === 'word') {
        cursor++;
        if (tokens[cursor]?.value === ',') cursor++;
      }
    }
    if (tokens[cursor]?.value === '{') cursor = afterBraces(cursor);
    else if (tokens[cursor]?.value === '*') {
      cursor++;
      if (tokens[cursor]?.value === 'as') cursor += 2;
    } else if (token.value === 'export') continue;
    if (tokens[cursor]?.type === 'word' && tokens[cursor].value === 'from') add(tokens[cursor + 1]);
  }
  return specifiers;
}

export function javascriptModuleSpecifiers(source) {
  return javascriptModuleReferences(source).map(reference => reference.specifier);
}
