const db = require('./db.cjs');

class AntiCheatEngine {
  // Strip comments, includes, and normalize whitespace
  cleanCode(code) {
    if (!code) return '';
    return code
      .replace(/\/\*[\s\S]*?\*\//g, '') // remove /* block comments */
      .replace(/\/\/.*$/gm, '')          // remove // line comments
      .replace(/#include\s*<.*?>/g, '')  // remove standard headers
      .replace(/using\s+namespace\s+std\s*;/g, '')
      .replace(/\s+/g, ' ')             // collapse whitespace
      .trim();
  }

  // Tokenize code structure into tokens
  tokenize(code) {
    const cleaned = this.cleanCode(code);
    const tokens = [];
    const regex = /[a-zA-Z_]\w*|\d+|[{}();,<>+\-*\/%=!&|~^]/g;
    let match;

    const keywords = new Set([
      'int', 'long', 'double', 'float', 'char', 'bool', 'void', 'string', 'vector',
      'if', 'else', 'for', 'while', 'do', 'return', 'switch', 'case', 'break', 'continue',
      'cin', 'cout', 'endl', 'true', 'false', 'struct', 'class'
    ]);

    while ((match = regex.exec(cleaned)) !== null) {
      const tok = match[0];
      if (keywords.has(tok)) {
        tokens.push(tok);
      } else if (/^\d+$/.test(tok)) {
        tokens.push('$NUM');
      } else if (/^[a-zA-Z_]\w*$/.test(tok)) {
        tokens.push('$ID');
      } else {
        tokens.push(tok);
      }
    }
    return tokens;
  }

  // Jaccard similarity of 3-grams
  calculateSimilarity(code1, code2) {
    const tokens1 = this.tokenize(code1);
    const tokens2 = this.tokenize(code2);

    if (tokens1.length === 0 || tokens2.length === 0) return 0;

    const nGramSize = 3;
    const getNgrams = (arr) => {
      const set = new Set();
      for (let i = 0; i <= arr.length - nGramSize; i++) {
        set.add(arr.slice(i, i + nGramSize).join(' '));
      }
      return set;
    };

    const set1 = getNgrams(tokens1);
    const set2 = getNgrams(tokens2);

    if (set1.size === 0 || set2.size === 0) {
      // Fallback exact token comparison
      let matches = 0;
      const minLen = Math.min(tokens1.length, tokens2.length);
      for (let i = 0; i < minLen; i++) {
        if (tokens1[i] === tokens2[i]) matches++;
      }
      return Math.round((matches / Math.max(tokens1.length, tokens2.length)) * 100);
    }

    let intersection = 0;
    for (const item of set1) {
      if (set2.has(item)) intersection++;
    }

    const union = set1.size + set2.size - intersection;
    return Math.round((intersection / union) * 100);
  }

  // Scan problem submissions for plagiarism
  scanProblemSubmissions(problemId, threshold = 60) {
    const submissions = db.getSubmissions({ problemId }).filter(s => s.status === 'AC');
    
    // Group by student, take their best / latest AC code
    const studentSubmissions = new Map();
    for (const sub of submissions) {
      if (!studentSubmissions.has(sub.userId)) {
        studentSubmissions.set(sub.userId, sub);
      }
    }

    const list = Array.from(studentSubmissions.values());
    const suspectPairs = [];

    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const sub1 = list[i];
        const sub2 = list[j];
        const similarity = this.calculateSimilarity(sub1.code, sub2.code);

        if (similarity >= threshold) {
          suspectPairs.push({
            id: `${sub1.id}_${sub2.id}`,
            student1: {
              id: sub1.userId,
              name: sub1.userName,
              submissionId: sub1.id,
              code: sub1.code,
              submittedAt: sub1.submittedAt
            },
            student2: {
              id: sub2.userId,
              name: sub2.userName,
              submissionId: sub2.id,
              code: sub2.code,
              submittedAt: sub2.submittedAt
            },
            similarity,
            riskLevel: similarity >= 85 ? 'HIGH' : similarity >= 70 ? 'MEDIUM' : 'LOW'
          });
        }
      }
    }

    return suspectPairs.sort((a, b) => b.similarity - a.similarity);
  }
}

module.exports = new AntiCheatEngine();
