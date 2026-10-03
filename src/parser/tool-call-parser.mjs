/**
 * Robust Dual-Mode Tool Call Parser (Hermes XML + JSON + OpenAI Schemas)
 * Extracts tool calls and thinking text cleanly from any model generation.
 */

export function parseToolCallsFromText(text) {
  if (!text || typeof text !== 'string') {
    return {
      thinking: '',
      toolCalls: [],
      rawText: text || ''
    };
  }

  const toolCalls = [];
  let cleanText = text;

  // Pattern 1: Hermes / XML Tag Style: <tool_call> ... </tool_call>
  const xmlRegex = /<tool_call>([\s\S]*?)<\/tool_call>/gi;
  let xmlMatch;
  while ((xmlMatch = xmlRegex.exec(text)) !== null) {
    const rawBlock = xmlMatch[1].trim();
    const parsed = tryParseXmlBlock(rawBlock);
    if (parsed) {
      toolCalls.push(parsed);
    }
  }

  if (toolCalls.length > 0) {
    cleanText = cleanText.replace(xmlRegex, '').trim();
    return {
      thinking: cleanText,
      toolCalls,
      rawText: text
    };
  }

  // Pattern 2: Fenced code block ```tool_call ... ``` or ```json with "name"/"tool"
  const fencedRegex = /```(?:tool_call|tool|action|json)?\s*([\s\S]*?)```/gi;
  let fencedMatch;
  while ((fencedMatch = fencedRegex.exec(text)) !== null) {
    const candidate = fencedMatch[1].trim();
    const parsed = tryParseJsonTool(candidate);
    if (parsed) {
      toolCalls.push(parsed);
    }
  }

  if (toolCalls.length > 0) {
    cleanText = cleanText.replace(fencedRegex, '').trim();
    return {
      thinking: cleanText,
      toolCalls,
      rawText: text
    };
  }

  // Pattern 3: Raw JSON object inside text { "name": "...", "arguments": { ... } }
  // Only look for explicit tool names
  const rawObjRegex = /\{\s*"(?:tool|name)"\s*:\s*"([a-zA-Z0-9_\-]+)"[\s\S]*?\}/g;
  let rawObjMatch;
  while ((rawObjMatch = rawObjRegex.exec(text)) !== null) {
    const candidate = rawObjMatch[0];
    const parsed = tryParseJsonTool(candidate);
    if (parsed) {
      toolCalls.push(parsed);
      cleanText = cleanText.replace(candidate, '').trim();
    }
  }

  return {
    thinking: cleanText,
    toolCalls,
    rawText: text
  };
}

function tryParseXmlBlock(block) {
  // Sub-case 1A: <name>...</name> <arguments>...</arguments>
  const nameMatch = block.match(/<name>([\s\S]*?)<\/name>/i);
  const argsMatch = block.match(/<arguments>([\s\S]*?)<\/arguments>/i);

  if (nameMatch) {
    const name = nameMatch[1].trim();
    let args = {};
    if (argsMatch) {
      try {
        args = parseFlexibleJson(argsMatch[1].trim());
      } catch {
        args = { raw: argsMatch[1].trim() };
      }
    }
    return { name, arguments: args };
  }

  // Sub-case 1B: JSON payload directly within <tool_call> ... </tool_call>
  return tryParseJsonTool(block);
}

function tryParseJsonTool(str) {
  try {
    const obj = parseFlexibleJson(str);
    if (!obj || typeof obj !== 'object') return null;

    const toolName = obj.name || obj.tool || obj.function;
    const toolArgs = obj.arguments || obj.args || obj.parameters || {};

    if (toolName && typeof toolName === 'string') {
      const finalArgs = typeof toolArgs === 'string' ? parseFlexibleJson(toolArgs) : toolArgs;
      return {
        name: toolName.trim(),
        arguments: finalArgs || {}
      };
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Parses JSON tolerating common LLM issues (trailing commas, escaped strings, etc.)
 */
export function parseFlexibleJson(raw) {
  if (typeof raw !== 'string') return raw;
  const clean = raw.trim();

  try {
    return JSON.parse(clean);
  } catch {
    // Try stripping trailing commas: e.g. { "a": 1, } -> { "a": 1 }
    const sansTrailingCommas = clean.replace(/,\s*([}\]])/g, '$1');
    try {
      return JSON.parse(sansTrailingCommas);
    } catch {
      // Try single quotes to double quotes if it looks like python dict
      const convertedQuotes = sansTrailingCommas
        .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"')
        .replace(/True/g, 'true')
        .replace(/False/g, 'false')
        .replace(/None/g, 'null');
      return JSON.parse(convertedQuotes);
    }
  }
}
