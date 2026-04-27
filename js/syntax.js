/* ============================================================
   SYNTAX.JS — Advanced Syntax Highlighting Engine
   VS Code Dark+ Theme Color Parity
   ============================================================ */

function syntaxHighlight(code) {
  if (!code) return '';
  let escaped = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Tokenization order matters — strings & comments first to avoid inner matches

  // Phase 1: Extract strings and comments into placeholders to protect them
  const tokens = [];
  let tokenIndex = 0;

  // Replace strings, comments, preprocessor directives with placeholders
  escaped = escaped.replace(
    /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|\/\/[^\n]*|\/\*[\s\S]*?\*\/|#\s*(?:include|define|ifndef|endif|ifdef|pragma|if|else|elif|undef)\b[^\n]*/g,
    function(match) {
      const id = `__TOKEN_${tokenIndex++}__`;
      let type;

      if (match.startsWith('"') || match.startsWith("'") || match.startsWith('`')) {
        type = 'string';
      } else if (match.startsWith('//') || match.startsWith('/*')) {
        type = 'comment';
      } else if (match.startsWith('#')) {
        type = 'preproc';
      }
      tokens.push({ id, match, type });
      return id;
    }
  );

  // Phase 2: Highlight C Standard Library functions
  escaped = escaped.replace(
    /\b(printf|scanf|fprintf|fscanf|sprintf|sscanf|snprintf|vprintf|vfprintf|vsprintf|vsnprintf|malloc|calloc|realloc|free|fgets|fputs|fopen|fclose|fread|fwrite|fseek|ftell|rewind|fflush|feof|ferror|clearerr|remove|rename|tmpfile|tmpnam|strlen|strcpy|strncpy|strcat|strncat|strcmp|strncmp|strchr|strrchr|strstr|strtok|strdup|memcpy|memset|memmove|memcmp|atoi|atof|atol|strtol|strtod|strtoul|strtof|strtold|abs|labs|fabs|sqrt|pow|ceil|floor|round|log|log10|log2|sin|cos|tan|asin|acos|atan|atan2|exp|ldexp|frexp|modf|fmod|rand|srand|time|clock|difftime|mktime|localtime|gmtime|strftime|asctime|ctime|getchar|putchar|puts|gets|getline|exit|abort|atexit|system|getenv|isalpha|isdigit|isalnum|isupper|islower|toupper|tolower|isspace|ispunct|isprint|iscntrl|isxdigit|qsort|bsearch|perror|signal|raise|setjmp|longjmp|assert)\b(?=\s*\()/g,
    '\uE000$1\uE00F'
  );

  // Phase 3: Detect user-defined function calls
  const reservedSet = 'if|else|for|while|do|switch|case|return|break|continue|default|goto|int|char|float|double|void|struct|typedef|enum|sizeof|unsigned|signed|long|short|bool|string|wchar_t|size_t|FILE|const|static|extern|volatile|register|inline|mutable|explicit|virtual|override|template|typename|auto|class|public|private|protected|new|delete|this|throw|try|catch|finally|using|namespace|std|cout|cin|endl|cerr|clog|union|restrict|true|false|null|undefined|NULL|nullptr|TRUE|FALSE|EOF|let|var|function|import|export|async|await|const_cast|static_cast|dynamic_cast|reinterpret_cast|friend|operator|printf|scanf|fprintf|fscanf|sprintf|sscanf|snprintf|malloc|calloc|realloc|free|fgets|fputs|fopen|fclose|fread|fwrite|fseek|ftell|rewind|fflush|strlen|strcpy|strncpy|strcat|strncat|strcmp|strncmp|strchr|strrchr|strstr|strtok|memcpy|memset|memmove|memcmp|atoi|atof|atol|strtol|strtod|abs|labs|fabs|sqrt|pow|ceil|floor|round|log|log10|sin|cos|tan|rand|srand|time|clock|getchar|putchar|puts|gets|getline|exit|abort|atexit|system|isalpha|isdigit|isalnum|isupper|islower|toupper|tolower|isspace|qsort|bsearch';
  const reservedWords = new Set(reservedSet.split('|'));

  escaped = escaped.replace(
    /\b([a-zA-Z_]\w*)\b(?=\s*\()/g,
    function(match, name) {
      if (reservedWords.has(name)) return match;
      return `\uE001${name}\uE00F`;
    }
  );

  // Phase 4: Data types
  escaped = escaped.replace(
    /\b(int|char|float|double|void|struct|typedef|enum|unsigned|signed|long|short|bool|string|wchar_t|size_t|FILE|union|auto)\b/g,
    '\uE002$1\uE00F'
  );

  // Phase 5: Control flow
  escaped = escaped.replace(
    /\b(if|else|for|while|do|switch|case|break|default|continue|return|goto)\b/g,
    '\uE003$1\uE00F'
  );

  // Phase 6: Language keywords
  escaped = escaped.replace(
    /\b(const|let|var|function|class|import|export|try|catch|finally|new|this|await|async|sizeof|static|extern|volatile|register|inline|mutable|explicit|virtual|override|template|typename|using|namespace|std|cout|cin|endl|cerr|clog|public|private|protected|nullptr|throw|delete|const_cast|static_cast|dynamic_cast|reinterpret_cast|friend|operator|restrict)\b/g,
    '\uE004$1\uE00F'
  );

  // Phase 7: Constants / Primitives
  escaped = escaped.replace(
    /\b(true|false|null|undefined|NULL|nullptr|TRUE|FALSE|EOF|SEEK_SET|SEEK_END|SEEK_CUR|stdin|stdout|stderr|INT_MAX|INT_MIN|CHAR_MAX|CHAR_MIN|LONG_MAX|LONG_MIN|UINT_MAX|SIZE_MAX|EXIT_SUCCESS|EXIT_FAILURE|RAND_MAX|BUFSIZ|FILENAME_MAX)\b/g,
    '\uE005$1\uE00F'
  );

  // Phase 8: Numbers
  escaped = escaped.replace(
    /\b(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?[fFlLuU]?\b|0[xX][0-9a-fA-F]+\b|0[bB][01]+\b)/g,
    '\uE006$1\uE00F'
  );

  // Phase 9: Operators
  escaped = escaped.replace(
    /(-&gt;|&lt;&lt;|&gt;&gt;|&lt;=|&gt;=|==|!=|&amp;&amp;|\|\||\+\+|--|\+=|-=|\*=|\/=|%=|&amp;=|\|=|\^=|&lt;&lt;=|&gt;&gt;=)/g,
    '\uE007$1\uE00F'
  );

  // Phase 10: Brackets
  escaped = escaped.replace(
    /([{}()\[\]])/g,
    '\uE008$1\uE00F'
  );

  // Phase 11: Restore tokens
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i];
    let replacement;

    if (t.type === 'string') {
      replacement = `\uE009${t.match}\uE00F`;
    } else if (t.type === 'comment') {
      replacement = `\uE00A${t.match}\uE00F`;
    } else if (t.type === 'preproc') {
      let preprocHTML = t.match;
      preprocHTML = preprocHTML.replace(
        /(&lt;[^&]*?\.h&gt;|"(?:[^"\\]|\\.)*")/g,
        '\uE00C$1\uE00F'
      );
      replacement = `\uE00B${preprocHTML}\uE00F`;
    }

    escaped = escaped.replace(t.id, replacement);
  }

  // Phase 12: Resolve Unicode tokens to final HTML classes
  return escaped
    .replace(/\uE000/g, '<span class="syntax-stdlib">')
    .replace(/\uE001/g, '<span class="syntax-function-call">')
    .replace(/\uE002/g, '<span class="syntax-type">')
    .replace(/\uE003/g, '<span class="syntax-control">')
    .replace(/\uE004/g, '<span class="syntax-keyword">')
    .replace(/\uE005/g, '<span class="syntax-primitive">')
    .replace(/\uE006/g, '<span class="syntax-number">')
    .replace(/\uE007/g, '<span class="syntax-operator">')
    .replace(/\uE008/g, '<span class="syntax-bracket">')
    .replace(/\uE009/g, '<span class="syntax-string">')
    .replace(/\uE00A/g, '<span class="syntax-comment">')
    .replace(/\uE00B/g, '<span class="syntax-preproc">')
    .replace(/\uE00C/g, '<span class="syntax-header">')
    .replace(/\uE00F/g, '</span>');
}
