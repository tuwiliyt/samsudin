import test from 'node:test';
import assert from 'node:assert/strict';
import { parseToolCallsFromText, parseFlexibleJson } from '../src/parser/tool-call-parser.mjs';

test('parseToolCallsFromText - extracts Hermes XML tool call with explicit tags', () => {
  const input = `
I will check the files in current directory.
<tool_call>
<name>bash</name>
<arguments>
{
  "command": "ls -la"
}
</arguments>
</tool_call>
`;

  const result = parseToolCallsFromText(input);
  assert.equal(result.toolCalls.length, 1);
  assert.equal(result.toolCalls[0].name, 'bash');
  assert.equal(result.toolCalls[0].arguments.command, 'ls -la');
  assert.ok(result.thinking.includes('I will check the files'));
});

test('parseToolCallsFromText - extracts XML tool call containing raw JSON', () => {
  const input = `
Inspecting configuration.
<tool_call>
{"name": "view_file", "arguments": {"filePath": "package.json", "startLine": 1}}
</tool_call>
`;

  const result = parseToolCallsFromText(input);
  assert.equal(result.toolCalls.length, 1);
  assert.equal(result.toolCalls[0].name, 'view_file');
  assert.equal(result.toolCalls[0].arguments.filePath, 'package.json');
});

test('parseToolCallsFromText - extracts markdown fenced tool_call', () => {
  const input = `
Editing the code now:
\`\`\`tool_call
{
  "name": "replace_file_content",
  "arguments": {
    "filePath": "src/index.js",
    "targetContent": "foo",
    "replacementContent": "bar"
  }
}
\`\`\`
`;

  const result = parseToolCallsFromText(input);
  assert.equal(result.toolCalls.length, 1);
  assert.equal(result.toolCalls[0].name, 'replace_file_content');
  assert.equal(result.toolCalls[0].arguments.targetContent, 'foo');
});

test('parseFlexibleJson - handles trailing commas and single quotes', () => {
  const jsonWithTrailingComma = '{"a": 1, "b": [2, 3,],}';
  const parsed1 = parseFlexibleJson(jsonWithTrailingComma);
  assert.equal(parsed1.a, 1);
  assert.equal(parsed1.b.length, 2);

  const pythonStyleDict = "{'name': 'bash', 'active': True}";
  const parsed2 = parseFlexibleJson(pythonStyleDict);
  assert.equal(parsed2.name, 'bash');
  assert.equal(parsed2.active, true);
});
