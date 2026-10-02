/**
 * Code::Blocks style C++ Autocomplete & Snippet Provider for Monaco Editor
 * Provides competitive programming snippets, STL containers, headers, loops, and syntax suggestions.
 */

let isRegistered = false;

export function registerCppSuggestions(monaco: any) {
  if (isRegistered || !monaco || !monaco.languages) return;
  isRegistered = true;

  monaco.languages.registerCompletionItemProvider('cpp', {
    triggerCharacters: ['#', '<', '.', ':', '>', '"', '/', ' '],
    provideCompletionItems: (model: any, position: any) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn
      };

      const { CompletionItemKind, CompletionItemInsertTextRule } = monaco.languages;

      const suggestions = [
        // ─── Headers & Preprocessor ──────────────────────────────
        {
          label: '#include <iostream>',
          kind: CompletionItemKind.Snippet,
          insertText: '#include <iostream>\n',
          detail: 'C++ standard I/O streams (<iostream>)',
          range
        },
        {
          label: '#include <vector>',
          kind: CompletionItemKind.Snippet,
          insertText: '#include <vector>\n',
          detail: 'Dynamic array container (<vector>)',
          range
        },
        {
          label: '#include <algorithm>',
          kind: CompletionItemKind.Snippet,
          insertText: '#include <algorithm>\n',
          detail: 'STL algorithms: sort, reverse, binary_search (<algorithm>)',
          range
        },
        {
          label: '#include <string>',
          kind: CompletionItemKind.Snippet,
          insertText: '#include <string>\n',
          detail: 'String class and utilities (<string>)',
          range
        },
        {
          label: '#include <cmath>',
          kind: CompletionItemKind.Snippet,
          insertText: '#include <cmath>\n',
          detail: 'Math functions: sqrt, pow, abs (<cmath>)',
          range
        },
        {
          label: '#include <iomanip>',
          kind: CompletionItemKind.Snippet,
          insertText: '#include <iomanip>\n',
          detail: 'I/O manipulators: setprecision, fixed (<iomanip>)',
          range
        },
        {
          label: '#include <map>',
          kind: CompletionItemKind.Snippet,
          insertText: '#include <map>\n',
          detail: 'Associative key-value map (<map>)',
          range
        },
        {
          label: '#include <set>',
          kind: CompletionItemKind.Snippet,
          insertText: '#include <set>\n',
          detail: 'Unique sorted set container (<set>)',
          range
        },
        {
          label: '#include <queue>',
          kind: CompletionItemKind.Snippet,
          insertText: '#include <queue>\n',
          detail: 'Queue & Priority Queue (<queue>)',
          range
        },
        {
          label: '#include <stack>',
          kind: CompletionItemKind.Snippet,
          insertText: '#include <stack>\n',
          detail: 'LIFO stack container (<stack>)',
          range
        },
        {
          label: '#include <bits/stdc++.h>',
          kind: CompletionItemKind.Snippet,
          insertText: '#include <bits/stdc++.h>\n',
          detail: 'Includes all standard C++ library headers',
          range
        },
        {
          label: 'using namespace std;',
          kind: CompletionItemKind.Snippet,
          insertText: 'using namespace std;\n',
          detail: 'Import standard namespace into global scope',
          range
        },

        // ─── Main Functions & Templates ──────────────────────────
        {
          label: 'main',
          kind: CompletionItemKind.Snippet,
          insertText: [
            'int main() {',
            '    ios_base::sync_with_stdio(false);',
            '    cin.tie(NULL);',
            '    ',
            '    ${0}',
            '    return 0;',
            '}'
          ].join('\n'),
          insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'Code::Blocks standard int main() template',
          range
        },
        {
          label: 'fastio',
          kind: CompletionItemKind.Snippet,
          insertText: [
            'ios_base::sync_with_stdio(false);',
            'cin.tie(NULL);'
          ].join('\n'),
          detail: 'Fast C++ I/O acceleration',
          range
        },
        {
          label: 'freopen',
          kind: CompletionItemKind.Snippet,
          insertText: [
            'freopen("${1:input}.inp", "r", stdin);',
            'freopen("${1:input}.out", "w", stdout);'
          ].join('\n'),
          insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'freopen file redirection for competitive programming',
          range
        },

        // ─── Control Flow & Loops ────────────────────────────────
        {
          label: 'for',
          kind: CompletionItemKind.Snippet,
          insertText: [
            'for (int ${1:i} = 0; ${1:i} < ${2:n}; ++${1:i}) {',
            '    ${0}',
            '}'
          ].join('\n'),
          insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'for (int i = 0; i < n; ++i)',
          range
        },
        {
          label: 'for1',
          kind: CompletionItemKind.Snippet,
          insertText: [
            'for (int ${1:i} = 1; ${1:i} <= ${2:n}; ++${1:i}) {',
            '    ${0}',
            '}'
          ].join('\n'),
          insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'for (int i = 1; i <= n; ++i)',
          range
        },
        {
          label: 'forr',
          kind: CompletionItemKind.Snippet,
          insertText: [
            'for (int ${1:i} = ${2:n} - 1; ${1:i} >= 0; --${1:i}) {',
            '    ${0}',
            '}'
          ].join('\n'),
          insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'Reverse for loop (n-1 down to 0)',
          range
        },
        {
          label: 'fora',
          kind: CompletionItemKind.Snippet,
          insertText: [
            'for (auto &${1:x} : ${2:container}) {',
            '    ${0}',
            '}'
          ].join('\n'),
          insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'Range-based for loop: for (auto &x : v)',
          range
        },
        {
          label: 'while',
          kind: CompletionItemKind.Snippet,
          insertText: [
            'while (${1:condition}) {',
            '    ${0}',
            '}'
          ].join('\n'),
          insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'while loop',
          range
        },
        {
          label: 'if',
          kind: CompletionItemKind.Snippet,
          insertText: [
            'if (${1:condition}) {',
            '    ${0}',
            '}'
          ].join('\n'),
          insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'if statement',
          range
        },
        {
          label: 'ifelse',
          kind: CompletionItemKind.Snippet,
          insertText: [
            'if (${1:condition}) {',
            '    ${2}',
            '} else {',
            '    ${0}',
            '}'
          ].join('\n'),
          insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'if ... else statement',
          range
        },
        {
          label: 'switch',
          kind: CompletionItemKind.Snippet,
          insertText: [
            'switch (${1:value}) {',
            '    case ${2:1}:',
            '        ${0}',
            '        break;',
            '    default:',
            '        break;',
            '}'
          ].join('\n'),
          insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'switch statement',
          range
        },

        // ─── Input / Output ──────────────────────────────────────
        {
          label: 'cin',
          kind: CompletionItemKind.Snippet,
          insertText: 'cin >> ${1:variable};',
          insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'Standard input stream',
          range
        },
        {
          label: 'cout',
          kind: CompletionItemKind.Snippet,
          insertText: 'cout << ${1:variable} << "\\n";',
          insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'Standard output stream with newline',
          range
        },
        {
          label: 'endl',
          kind: CompletionItemKind.Keyword,
          insertText: 'endl',
          detail: 'Flush and insert newline',
          range
        },

        // ─── STL Containers & Data Structures ───────────────────
        {
          label: 'vector',
          kind: CompletionItemKind.Class,
          insertText: 'vector<${1:int}> ${2:v};',
          insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'std::vector<T> dynamic array',
          range
        },
        {
          label: 'vector2d',
          kind: CompletionItemKind.Snippet,
          insertText: 'vector<vector<${1:int}>> ${2:grid}(${3:n}, vector<${1:int}>(${4:m}, ${5:0}));',
          insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
          detail: '2D matrix vector<vector<int>>',
          range
        },
        {
          label: 'pair',
          kind: CompletionItemKind.Class,
          insertText: 'pair<${1:int}, ${2:int}> ${3:p};',
          insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'std::pair<T1, T2>',
          range
        },
        {
          label: 'map',
          kind: CompletionItemKind.Class,
          insertText: 'map<${1:string}, ${2:int}> ${3:mp};',
          insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'std::map<Key, Value>',
          range
        },
        {
          label: 'set',
          kind: CompletionItemKind.Class,
          insertText: 'set<${1:int}> ${2:st};',
          insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'std::set<T> unique ordered set',
          range
        },
        {
          label: 'queue',
          kind: CompletionItemKind.Class,
          insertText: 'queue<${1:int}> ${2:q};',
          insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'std::queue<T> FIFO queue',
          range
        },
        {
          label: 'stack',
          kind: CompletionItemKind.Class,
          insertText: 'stack<${1:int}> ${2:stk};',
          insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'std::stack<T> LIFO stack',
          range
        },
        {
          label: 'priority_queue',
          kind: CompletionItemKind.Class,
          insertText: 'priority_queue<${1:int}> ${2:pq};',
          insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'std::priority_queue<T> Max-Heap',
          range
        },
        {
          label: 'priority_queue_min',
          kind: CompletionItemKind.Snippet,
          insertText: 'priority_queue<${1:int}, vector<${1:int}>, greater<${1:int}>> ${2:pq};',
          insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'std::priority_queue Min-Heap',
          range
        },

        // ─── STL Algorithms & Utility ───────────────────────────
        {
          label: 'sort',
          kind: CompletionItemKind.Function,
          insertText: 'sort(${1:v}.begin(), ${1:v}.end());',
          insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'sort vector in ascending order',
          range
        },
        {
          label: 'sort_desc',
          kind: CompletionItemKind.Snippet,
          insertText: 'sort(${1:v}.begin(), ${1:v}.end(), greater<${2:int}>());',
          insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'sort vector in descending order',
          range
        },
        {
          label: 'reverse',
          kind: CompletionItemKind.Function,
          insertText: 'reverse(${1:v}.begin(), ${1:v}.end());',
          insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'reverse elements in range',
          range
        },
        {
          label: 'binary_search',
          kind: CompletionItemKind.Function,
          insertText: 'binary_search(${1:v}.begin(), ${1:v}.end(), ${2:val})',
          insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'binary search for value (returns bool)',
          range
        },
        {
          label: 'lower_bound',
          kind: CompletionItemKind.Function,
          insertText: 'lower_bound(${1:v}.begin(), ${1:v}.end(), ${2:val})',
          insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'first element >= val iterator',
          range
        },
        {
          label: 'upper_bound',
          kind: CompletionItemKind.Function,
          insertText: 'upper_bound(${1:v}.begin(), ${1:v}.end(), ${2:val})',
          insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'first element > val iterator',
          range
        },
        {
          label: 'min',
          kind: CompletionItemKind.Function,
          insertText: 'min(${1:a}, ${2:b})',
          insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'Returns smaller of a and b',
          range
        },
        {
          label: 'max',
          kind: CompletionItemKind.Function,
          insertText: 'max(${1:a}, ${2:b})',
          insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'Returns larger of a and b',
          range
        },
        {
          label: 'swap',
          kind: CompletionItemKind.Function,
          insertText: 'swap(${1:a}, ${2:b});',
          insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'Swap contents of a and b',
          range
        },
        {
          label: 'push_back',
          kind: CompletionItemKind.Method,
          insertText: 'push_back(${1:x});',
          insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'Append element to vector/deque',
          range
        },

        // ─── Struct & Definitions ────────────────────────────────
        {
          label: 'struct',
          kind: CompletionItemKind.Snippet,
          insertText: [
            'struct ${1:Item} {',
            '    ${2:int id};',
            '    ${0}',
            '};'
          ].join('\n'),
          insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet,
          detail: 'struct definition',
          range
        },
        {
          label: 'typedef ll',
          kind: CompletionItemKind.Snippet,
          insertText: 'typedef long long ll;\n',
          detail: 'Shortcut for long long',
          range
        },

        // ─── Common C++ Types & Keywords ─────────────────────────
        { label: 'int', kind: CompletionItemKind.Keyword, insertText: 'int ', range },
        { label: 'long long', kind: CompletionItemKind.Keyword, insertText: 'long long ', range },
        { label: 'double', kind: CompletionItemKind.Keyword, insertText: 'double ', range },
        { label: 'float', kind: CompletionItemKind.Keyword, insertText: 'float ', range },
        { label: 'char', kind: CompletionItemKind.Keyword, insertText: 'char ', range },
        { label: 'bool', kind: CompletionItemKind.Keyword, insertText: 'bool ', range },
        { label: 'string', kind: CompletionItemKind.Keyword, insertText: 'string ', range },
        { label: 'void', kind: CompletionItemKind.Keyword, insertText: 'void ', range },
        { label: 'auto', kind: CompletionItemKind.Keyword, insertText: 'auto ', range },
        { label: 'const', kind: CompletionItemKind.Keyword, insertText: 'const ', range },
        { label: 'return', kind: CompletionItemKind.Keyword, insertText: 'return ', range },
        { label: 'break;', kind: CompletionItemKind.Keyword, insertText: 'break;\n', range },
        { label: 'continue;', kind: CompletionItemKind.Keyword, insertText: 'continue;\n', range },
        { label: 'true', kind: CompletionItemKind.Keyword, insertText: 'true', range },
        { label: 'false', kind: CompletionItemKind.Keyword, insertText: 'false', range },
        { label: 'sizeof', kind: CompletionItemKind.Keyword, insertText: 'sizeof(${1:val})', insertTextRules: CompletionItemInsertTextRule.InsertAsSnippet, range },
        { label: 'nullptr', kind: CompletionItemKind.Keyword, insertText: 'nullptr', range }
      ];

      return { suggestions };
    }
  });
}
