/* ============================================================
   DIFF.JS — Character-Level Diff Engine with Comment Stripping
   ============================================================ */

// --- Comment Stripping (Feature 2) ---
function stripComments(code) {
  if (!code) return '';
  let result = '';
  let i = 0;
  let inString = false;
  let stringChar = '';

  while (i < code.length) {
    // Handle string literals (don't strip comments inside strings)
    if (!inString && (code[i] === '"' || code[i] === "'")) {
      inString = true;
      stringChar = code[i];
      result += code[i];
      i++;
      continue;
    }

    if (inString) {
      if (code[i] === '\\' && i + 1 < code.length) {
        result += code[i] + code[i + 1];
        i += 2;
        continue;
      }
      if (code[i] === stringChar) {
        inString = false;
      }
      result += code[i];
      i++;
      continue;
    }

    // Single-line comment
    if (code[i] === '/' && i + 1 < code.length && code[i + 1] === '/') {
      // Skip until end of line (do not consume the newline character)
      while (i < code.length && code[i] !== '\n') i++;
      continue;
    }

    // Multi-line comment
    if (code[i] === '/' && i + 1 < code.length && code[i + 1] === '*') {
      i += 2;
      while (i < code.length && !(code[i] === '*' && i + 1 < code.length && code[i + 1] === '/')) {
        if (code[i] === '\n') result += '\n'; // Preserve newlines to keep lines synced!
        i++;
      }
      if (i < code.length) i += 2; // skip */
      continue;
    }

    result += code[i];
    i++;
  }

  return result;
}

// --- Character-Level LCS (Feature 1) ---
function computeCharLCS(a, b) {
  const n = a.length;
  const m = b.length;

  let prev = new Array(m + 1).fill(0);
  let curr = new Array(m + 1).fill(0);

  const dp = [];
  for (let i = 0; i <= n; i++) {
    dp[i] = new Array(m + 1).fill(0);
  }

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const matchA = new Set();
  const matchB = new Set();
  let i = n, j = m;

  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      matchA.add(i - 1);
      matchB.add(j - 1);
      i--; j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return { matchA, matchB, lcsLength: dp[n][m] };
}

function computeCharDiffs(actualLine, expectedLine) {
  const normA = actualLine.replace(/\s/g, '');
  const normE = expectedLine.replace(/\s/g, '');

  const mapA = [];
  for (let i = 0; i < actualLine.length; i++) {
    if (actualLine[i] !== ' ' && actualLine[i] !== '\t') {
      mapA.push(i);
    }
  }

  const mapE = [];
  for (let i = 0; i < expectedLine.length; i++) {
    if (expectedLine[i] !== ' ' && expectedLine[i] !== '\t') {
      mapE.push(i);
    }
  }

  const { matchA, matchB } = computeCharLCS(normA, normE);

  const actualChars = [];
  let normIdx = 0;
  for (let i = 0; i < actualLine.length; i++) {
    if (actualLine[i] === ' ' || actualLine[i] === '\t') {
      actualChars.push({ char: actualLine[i], status: 'neutral' });
    } else {
      if (matchA.has(normIdx)) {
        actualChars.push({ char: actualLine[i], status: 'match' });
      } else {
        const ch = actualLine[i];
        const existsInExpected = normE.includes(ch);
        actualChars.push({ char: ch, status: existsInExpected ? 'offset' : 'wrong' });
      }
      normIdx++;
    }
  }

  const expectedChars = [];
  normIdx = 0;
  for (let i = 0; i < expectedLine.length; i++) {
    if (expectedLine[i] === ' ' || expectedLine[i] === '\t') {
      expectedChars.push({ char: expectedLine[i], status: 'neutral' });
    } else {
      if (matchB.has(normIdx)) {
        expectedChars.push({ char: expectedLine[i], status: 'match' });
      } else {
        expectedChars.push({ char: expectedLine[i], status: 'missing' });
      }
      normIdx++;
    }
  }

  const matchCount = matchA.size;
  const totalChars = Math.max(normA.length, normE.length) || 1;
  const ratio = matchCount / totalChars;

  return { actualChars, expectedChars, ratio };
}

// --- Line-Level Alignment (Optimized for lazy evaluation) ---
function computeDiffs(userCode, expectedCode) {
  const strippedUser = stripComments(userCode);
  const strippedExpected = stripComments(expectedCode);

  const normalizeLine = s => s.replace(/\s+/g, '').trim();

  // Process data using strictly the stripped versions 
  const stripULines = strippedUser.split('\n');
  const uLinesData = [];
  for (let i = 0; i < stripULines.length; i++) {
    const stripped = stripULines[i];
    const norm = normalizeLine(stripped);
    if (norm !== '') {
      uLinesData.push({ stripped: stripped, norm: norm });
    }
  }

  const stripCLines = strippedExpected.split('\n');
  const cLinesData = [];
  for (let i = 0; i < stripCLines.length; i++) {
    const stripped = stripCLines[i];
    const norm = normalizeLine(stripped);
    if (norm !== '') {
      cLinesData.push({ stripped: stripped, norm: norm });
    }
  }

  const n = uLinesData.length;
  const m = cLinesData.length;

  const dp = Array(n + 1).fill(null).map(() => Array(m + 1).fill(0));

  for (let i = 1; i <= n; i++) dp[i][0] = i;
  for (let j = 1; j <= m; j++) dp[0][j] = j;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const normU = uLinesData[i - 1].norm;
      const normC = cLinesData[j - 1].norm;

      if (normU === normC) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        const sim = calculateSimilarity(uLinesData[i - 1].stripped, cLinesData[j - 1].stripped);
        const subCost = sim > 0.5 ? 0.5 : 2;

        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + subCost
        );
      }
    }
  }

  let i2 = n, j2 = m;
  const diffs = [];
  let totalScore = 0;

  while (i2 > 0 || j2 > 0) {
    if (i2 > 0 && j2 > 0) {
      const uData = uLinesData[i2 - 1];
      const cData = cLinesData[j2 - 1];

      if (uData.norm === cData.norm && dp[i2][j2] === dp[i2 - 1][j2 - 1]) {
        diffs.unshift({
          status: 'perfect',
          actual: uData.stripped,
          expected: cData.stripped
        });
        totalScore += 1;
        i2--; j2--;
        continue;
      }

      const sim = calculateSimilarity(uData.stripped, cData.stripped);
      const subCost = sim > 0.5 ? 0.5 : 2;

      if (dp[i2][j2] === dp[i2 - 1][j2 - 1] + subCost) {
        const lineStatus = sim > 0.5 ? 'partial' : 'wrong';

        diffs.unshift({
          status: lineStatus,
          actual: uData.stripped,
          expected: cData.stripped
        });
        totalScore += (sim > 0.5 ? 0.8 : 0);
        i2--; j2--;
        continue;
      }
    }

    if (i2 > 0 && (j2 === 0 || dp[i2][j2] === dp[i2 - 1][j2] + 1)) {
      diffs.unshift({
        status: 'extra',
        actual: uLinesData[i2 - 1].stripped,
        expected: null
      });
      i2--;
    } else {
      diffs.unshift({
        status: 'missing',
        actual: null,
        expected: cLinesData[j2 - 1].stripped
      });
      j2--;
    }
  }

  return { diffs, scoreCount: totalScore, cLinesLen: cLinesData.length || 1 };
}