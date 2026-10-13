'use strict';
const assert = require('node:assert/strict');
const { SourceMap } = require('node:module');
const { posix, resolve } = require('node:path');
const fs = require('node:fs');
const isAppSource = source => ('/' + source).includes('/src/') && !/(^|\/)(node_modules|vendor)(\/|$)/i.test(source);

function sourceName(source, root = '') {
  source = source.replace(/\\/g, '/'); root = root.replace(/\\/g, '/');
  const name = /^[a-z][\w+.-]*:\/\//i.test(source) ? new URL(source).href : /^[a-z][\w+.-]*:\/\//i.test(root) ? new URL(source, root.replace(/\/?$/, '/')).href : posix.normalize(source.startsWith('/') || /^[a-z]:\//i.test(source) ? source : root + '/' + source);
  return isAppSource(name) ? name.slice(name.indexOf('/src/')) : name;
}
function mappingSpans(code, payload) {
  assert.ok(typeof code === 'string' && payload?.version === 3 && typeof payload.mappings === 'string' && !payload.sections, 'Expected code and flat v3 source map');
  assert.ok(Array.isArray(payload.sources) && payload.sources.every(source => typeof source === 'string'), 'Invalid sources');
  assert.ok(payload.sourceRoot == null || typeof payload.sourceRoot === 'string', 'Invalid sourceRoot');
  assert.ok(payload.sourcesContent == null || (Array.isArray(payload.sourcesContent) && payload.sourcesContent.length === payload.sources.length && payload.sourcesContent.every(content => content == null || typeof content === 'string')), 'Invalid sourcesContent');
  const sourceMap = new SourceMap(payload), generatedLines = code.split('\n'), spans = [];
  const sourceNames = payload.sources.map(source => sourceName(source, payload.sourceRoot ?? ''));
  const contentLines = payload.sources.map((_, index) => payload.sourcesContent?.[index]?.split('\n'));
  let offset = 0, sourceIndex = 0, originalLine = 0, originalColumn = 0;
  const mappingLines = payload.mappings.split(';');
  for (const [lineIndex, encodedLine] of mappingLines.entries()) {
    assert.ok(lineIndex < generatedLines.length || !encodedLine, 'Mappings exceed generated lines');
    let column = 0;
    const entries = [];
    for (const segment of encodedLine ? encodedLine.split(',') : []) {
      const fields = []; let value = 0, multiplier = 1;
      for (const character of segment) {
        const digit = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'.indexOf(character);
        assert.ok(digit >= 0, 'Invalid VLQ character'); value += (digit % 32) * multiplier;
        assert.ok(Number.isSafeInteger(value) && Number.isSafeInteger(multiplier), 'VLQ overflow');
        if (digit < 32) { fields.push(value % 2 ? -Math.floor(value / 2) : value / 2); value = 0; multiplier = 1; } else multiplier *= 32;
      }
      assert.ok(multiplier === 1 && [1, 4, 5].includes(fields.length), 'Invalid mapping segment');
      column += fields[0]; assert.ok(fields[0] >= 0 && column <= generatedLines[lineIndex].length, 'Invalid generated column');
      let entry = null;
      if (fields.length > 1) {
        sourceIndex += fields[1]; originalLine += fields[2]; originalColumn += fields[3];
        assert.ok(sourceIndex >= 0 && sourceIndex < payload.sources.length && originalLine >= 0 && originalColumn >= 0, 'Invalid original position');
        const content = contentLines[sourceIndex];
        assert.ok(!content || (originalLine < content.length && originalColumn <= content[originalLine].length), 'Original position exceeds sourcesContent');
        entry = { originalSource: payload.sources[sourceIndex], originalLine };
      }
      entries.push({ column, source: entry ? sourceNames[sourceIndex] : null, line: entry ? entry.originalLine + 1 : null });
    }
    for (const [index, entry] of entries.entries()) {
      const end = entries[index + 1]?.column ?? generatedLines[lineIndex].length;
      if (end <= entry.column) continue;
      const found = entry.source && isAppSource(entry.source) ? sourceMap.findEntry(lineIndex, entry.column) : null;
      assert.ok(!found || (sourceName(found.originalSource, payload.sourceRoot ?? '') === entry.source && found.originalLine + 1 === entry.line), 'SourceMap lookup mismatch');
      spans.push({ start: offset + entry.column, end: offset + end, source: entry.source, line: entry.line });
    }
    offset += (generatedLines[lineIndex]?.length ?? 0) + 1;
  }
  return spans;
}
function rangeRuns(script, length) {
  assert.ok(script && Array.isArray(script.functions), 'Expected flat ScriptCoverage');
  const ranges = script.functions.flatMap(fn => { assert.ok(Array.isArray(fn.ranges), 'Invalid function ranges'); return fn.ranges; });
  for (const range of ranges) assert.ok(range && Number.isSafeInteger(range.startOffset) && Number.isSafeInteger(range.endOffset) && range.startOffset >= 0 && range.startOffset <= range.endOffset && range.endOffset <= length && Number.isSafeInteger(range.count) && range.count >= 0, 'Invalid V8 range');
  const sorted = ranges.filter(range => range.endOffset > range.startOffset).sort((left, right) => left.startOffset - right.startOffset || right.endOffset - left.endOffset || right.count - left.count);
  const stack = [], runs = []; let cursor = 0;
  const flush = stop => {
    while (cursor < stop) {
      while (stack.length && stack.at(-1).endOffset <= cursor) stack.pop();
      const winner = stack.at(-1), end = Math.min(stop, winner?.endOffset ?? stop);
      if (winner) runs.push({ start: cursor, end, hit: winner.count > 0 });
      cursor = end;
    }
    while (stack.length && stack.at(-1).endOffset <= cursor) stack.pop();
  };
  for (const range of sorted) {
    flush(range.startOffset);
    assert.ok(!stack.length || range.endOffset <= stack.at(-1).endOffset, 'Crossing V8 ranges are unsupported');
    stack.push(range);
  }
  flush(length); return runs;
}
function summarizeFunctions(spans, snapshots) {
  const observed = new Map();
  for (const script of snapshots) for (const fn of script.functions) {
    const range = fn.ranges[0]; assert.ok(range, 'V8 function missing first range');
    const key = range.startOffset + ':' + range.endOffset;
    observed.set(key, { startOffset: range.startOffset, endOffset: range.endOffset, hit: range.count > 0 || observed.get(key)?.hit === true });
  }
  const functionCounts = new Map(), unmappedFunctions = [], excludedFunctions = [];
  let total = 0, covered = 0;
  for (const range of observed.values()) {
    let low = 0, high = spans.length;
    while (low < high) { const middle = Math.floor((low + high) / 2); if (spans[middle].start <= range.startOffset) low = middle + 1; else high = middle; }
    const span = spans[low - 1], source = span && range.startOffset < span.end ? span.source : null;
    if (source && isAppSource(source)) {
      const previous = functionCounts.get(source) ?? { observedFunctions: 0, hitFunctions: 0 };
      functionCounts.set(source, { observedFunctions: previous.observedFunctions + 1, hitFunctions: previous.hitFunctions + Number(range.hit) });
      total++; covered += Number(range.hit);
    } else if (source) excludedFunctions.push({ ...range, source });
    else unmappedFunctions.push(range);
  }
  return { functionCounts, functionCoverage: { metric: 'mapped observed V8 function coverage', covered, total, ratio: total ? covered / total : null, unmappedFunctionCount: unmappedFunctions.length, unmappedFunctions, excludedFunctionCount: excludedFunctions.length, excludedFunctions, limitations: [
    'Observed V8 functions only; first-range count > 0 defines a hit, OR across exact generated start/end keys. Child block hits do not redefine function hits.',
    'Only the mapped span at function start determines source. Unmapped/vendor/bundle roots are not attributed by deeper intersections.',
    'Not AST or conventional branch coverage, not a full-repository function census, and not standalone proof of 80% acceptance.'
  ] } };
}
function mapCoverage(generatedCode, sourceMapPayload, v8ScriptCoverage) {
  const spans = mappingSpans(generatedCode, sourceMapPayload);
  const sources = [...new Set(sourceMapPayload.sources.map(source => sourceName(source, sourceMapPayload.sourceRoot ?? '')))];
  const included = isAppSource;
  const files = new Map(sources.filter(included).map(source => [source, { executable: new Set(), hits: new Set() }]));
  const snapshots = Array.isArray(v8ScriptCoverage) ? v8ScriptCoverage : [v8ScriptCoverage];
  const unmappedRanges = [];
  for (const [snapshot, script] of snapshots.entries()) {
    let spanIndex = 0;
    for (const run of rangeRuns(script, generatedCode.length)) {
      let cursor = run.start;
      while (spanIndex < spans.length && spans[spanIndex].end <= cursor) spanIndex++;
      while (cursor < run.end) {
        const span = spans[spanIndex], mapped = span && span.start <= cursor;
        const end = Math.min(run.end, mapped ? span.end : span?.start ?? run.end);
        if (!mapped || !span.source) unmappedRanges.push({ snapshot, startOffset: cursor, endOffset: end, hit: run.hit });
        else if (files.has(span.source)) { const file = files.get(span.source); file.executable.add(span.line); if (run.hit) file.hits.add(span.line); }
        cursor = end; if (span && span.end <= cursor) spanIndex++;
      }
    }
  }
  const { functionCounts, functionCoverage } = summarizeFunctions(spans, snapshots);
  const perFile = Object.fromEntries([...files].map(([source, file]) => {
    const executableLines = [...file.executable].sort((left, right) => left - right), coveredLines = [...file.hits].sort((left, right) => left - right);
    return [source, { covered: coveredLines.length, total: executableLines.length, executableLines, coveredLines, uncoveredLines: executableLines.filter(line => !file.hits.has(line)), ...(functionCounts.get(source) ?? { observedFunctions: 0, hitFunctions: 0 }) }];
  }));
  const covered = Object.values(perFile).reduce((sum, file) => sum + file.covered, 0), total = Object.values(perFile).reduce((sum, file) => sum + file.total, 0);
  const missingSourcesContent = [...new Set(sourceMapPayload.sources.flatMap((source, index) => sourceMapPayload.sourcesContent?.[index] == null ? [sourceName(source, sourceMapPayload.sourceRoot ?? '')] : []))];
  return { metric: 'mapped executable source-line coverage', covered, total, ratio: total ? covered / total : null, perFile, functionCoverage, unmappedSources: [...files.keys()].filter(source => !perFile[source].total), excludedSources: sources.filter(source => !included(source)), unmappedRanges, missingSourcesContent, limitations: [
    'Denominator: unique app /src/ lines with nonempty mapped generated spans intersecting observed V8 ranges; not an AST executable-line census.',
    'Numerator: denominator lines with any positive most-specific range in any snapshot; partial-line hits count. Equal ranges conservatively prefer zero.',
    'Not conventional branch/function coverage or proof of 80% acceptance. Caller must URL-filter same-bundle snapshots and pair the exact code/map.',
    'Unmapped/type-only/tree-shaken lines and sources outside the payload are not counted; zero-total sources remain listed. No type-only inference.',
    'Generated LF/UTF16 offsets; explicit unmapped segments and generated gaps do not inherit mappings. Indexed maps and crossing ranges rejected.',
    'sourcesContent validates original positions when present; absent content limits verification. Function-only V8 data cannot establish block hits.'
  ] };
}
function selfcheck() {
  const script = ranges => ({ functions: [{ functionName: '', isBlockCoverage: true, ranges }] });
  const range = (startOffset, endOffset, count) => ({ startOffset, endOffset, count });
  const code = 'aa\nbb\ncc\ndd';
  const payload = { version: 3, sourceRoot: '/app', sources: ['src/a.ts', 'src/types.ts'], sourcesContent: [code, 'type T = string;'], names: [], mappings: 'AAAA;AACA;AACA;AACA' };
  const first = script([range(0, 11, 1), range(3, 8, 0), range(6, 8, 1)]);
  first.functions.push({ functionName: 'unused', isBlockCoverage: true, ranges: [range(9, 11, 0)] });
  const result = mapCoverage(code, payload, first);
  assert.equal(result.total, 4);
  assert.equal(result.covered, 2);
  assert.deepEqual([result.functionCoverage.total, result.functionCoverage.covered], [2, 1]);
  assert.deepEqual([result.perFile['/src/a.ts'].observedFunctions, result.perFile['/src/a.ts'].hitFunctions], [2, 1]);
  const nestedFunctions = { functions: [script([range(0, 11, 0)]).functions[0], script([range(6, 8, 0)]).functions[0], script([range(9, 11, 0)]).functions[0]] };
  const repeatedFunctions = mapCoverage(code, payload, [nestedFunctions, script([range(6, 8, 1)]), nestedFunctions]);
  assert.deepEqual([repeatedFunctions.functionCoverage.total, repeatedFunctions.functionCoverage.covered], [3, 1]);
  assert.equal(repeatedFunctions.perFile['/src/a.ts'].hitFunctions, 1);
  assert.equal(mapCoverage(code, payload, script([range(0, 11, 0), range(6, 8, 1)])).functionCoverage.covered, 0);
  assert.deepEqual(result.perFile['/src/a.ts'].coveredLines, [1, 3]);
  assert.equal(result.perFile['/src/types.ts'].total, 0);
  assert.ok(result.unmappedSources.includes('/src/types.ts'));
  assert.equal(mapCoverage(code, payload, [first, script([range(0, 11, 0), range(3, 5, 1)])]).covered, 3);
  assert.equal(mapCoverage(code, payload, [first, first]).covered, 2);
  const mixed = { version: 3, sources: ['/src/a.ts', '/src/b.ts', '/node_modules/src/lib.ts', '/vendor/src/lib.ts', '/src/types.ts'], sourcesContent: ['aa', 'bb', 'cc', 'dd', 'type T = 1;'], names: [], mappings: 'AAAA,E,ECAA,ECAA,ECAA' };
  const minified = mapCoverage('aabbccddee', mixed, script([range(0, 10, 1), range(4, 6, 0)]));
  assert.equal(minified.total, 2);
  assert.equal(minified.covered, 1);
  assert.equal(minified.excludedSources.length, 2);
  assert.ok(minified.unmappedRanges.some(entry => entry.startOffset === 2 && entry.endOffset === 4));
  const unclassified = mapCoverage('aabbccddee', mixed, { functions: [script([range(2, 10, 1)]).functions[0], script([range(6, 8, 0)]).functions[0]] });
  assert.equal(unclassified.functionCoverage.total, 0);
  assert.equal(unclassified.functionCoverage.unmappedFunctionCount, 1);
  assert.deepEqual(unclassified.functionCoverage.unmappedFunctions, [{ startOffset: 2, endOffset: 10, hit: true }]);
  assert.equal(unclassified.functionCoverage.excludedFunctionCount, 1);
  const utf16 = { ...payload, sources: ['src/a.ts'], sourcesContent: ['one\ntwo'], mappings: 'AAAA;AACA' };
  assert.deepEqual(mapCoverage('\ud83d\ude00\nx', utf16, script([range(0, 4, 0), range(3, 4, 1)])).perFile['/src/a.ts'].coveredLines, [2]);
  assert.equal(mapCoverage(code, payload, []).total, 0);
  const windows = mapCoverage('xxaabb', { version: 3, sources: ['F:/CODE/thienmenh/thienmenh/src/a.ts', 'F:/CODE/thienmenh/thienmenh/node_modules/phaser/dist/phaser.esm.js'], names: [], mappings: 'EAAA,ECAA' }, script([range(0, 6, 0)]));
  assert.deepEqual([windows.perFile['/src/a.ts'].covered, windows.total, windows.excludedSources.length], [0, 1, 1]);
  assert.deepEqual(windows.unmappedRanges[0], { snapshot: 0, startOffset: 0, endOffset: 2, hit: false });
  assert.ok(windows.missingSourcesContent.includes('/src/a.ts'));
  assert.equal(windows.functionCoverage.unmappedFunctionCount, 1);
  assert.equal(windows.functionCoverage.total, 0);
  assert.throws(() => mapCoverage(code, payload, script([range(-1, 11, 1)])));
  assert.throws(() => mapCoverage(code, { ...payload, mappings: '?' }, first));
  console.log('selfcheck GREEN: source lines; observed first-range functions; nested zero/unused; repeated OR; unmapped/vendor start-only classification; boundaries; LF/UTF16; validation');
}
module.exports = { mapCoverage };
if (require.main === module) {
  try {
    const [input, output, extra] = process.argv.slice(2);
    if (input === '--selfcheck' && !output) selfcheck();
    else {
      assert.ok(!extra, 'Usage: node scripts/map-v8-coverage.cjs [raw.json|-] [output.json]');
      assert.ok(!output || !input || input === '-' || resolve(input) !== resolve(output), 'Output must not overwrite input');
      const raw = JSON.parse(fs.readFileSync(input && input !== '-' ? input : 0, 'utf8'));
      const json = JSON.stringify(mapCoverage(raw.code, raw.sourceMap, raw.coverage), null, 2) + '\n';
      if (output) fs.writeFileSync(output, json, { flag: 'wx' });
      process.stdout.write(json);
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
