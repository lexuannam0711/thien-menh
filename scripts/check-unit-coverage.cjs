'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL, fileURLToPath } = require('node:url');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const ts = require('typescript');
const { mapCoverage } = require('./map-v8-coverage.cjs');
const root = path.resolve(__dirname, '..');
const entry = 'src/game/ui/rpgMenuSelfCheck.ts';
const hash = value => createHash('sha256').update(value).digest('hex');
const name = file => path.relative(root, file).replaceAll('\\', '/');
const urlKey = url => url.startsWith('file:') ? pathToFileURL(fileURLToPath(url)).href : url;

function removeTemp(directory) {
  const absolute = path.resolve(directory);
  assert.ok(path.basename(absolute).startsWith('thienmenh-unit-coverage-') && fs.realpathSync(path.dirname(absolute)) === fs.realpathSync(os.tmpdir()) && !fs.lstatSync(absolute).isSymbolicLink() && fs.lstatSync(absolute).isDirectory(), 'Unsafe temp cleanup');
  assert.equal(fs.realpathSync(absolute), absolute, 'Unsafe temp cleanup');
  fs.rmSync(absolute, { recursive: true, force: true });
}

function mapRuntime(raw, modules) {
  assert.ok(raw && Array.isArray(raw.result), 'Invalid raw coverage');
  for (const script of raw.result) {
    assert.ok(script && typeof script.url === 'string' && Array.isArray(script.functions), 'Invalid raw coverage');
    for (const fn of script.functions) {
      assert.ok(fn && Array.isArray(fn.ranges) && fn.ranges.length, 'Invalid raw coverage');
      for (const range of fn.ranges) assert.ok(range && Number.isSafeInteger(range.startOffset) && Number.isSafeInteger(range.endOffset) && range.startOffset >= 0 && range.endOffset >= range.startOffset && Number.isSafeInteger(range.count) && range.count >= 0, 'Invalid raw coverage');
    }
  }
  const measured = modules.map(module => {
    const code = fs.readFileSync(module.runtime, 'utf8');
    const mapText = fs.readFileSync(module.runtime + '.map', 'utf8');
    const source = fs.readFileSync(module.source, 'utf8');
    assert.equal(hash(code), module.codeHash, 'Runtime hash mismatch');
    assert.equal(hash(mapText), module.mapHash, 'Map hash mismatch');
    assert.equal(hash(source), module.sourceHash, 'Source hash mismatch');
    const map = JSON.parse(mapText);
    assert.ok(map.version === 3 && map.sources?.length === 1 && map.sourcesContent?.length === 1 && !map.sourceRoot, 'Invalid runtime source map');
    const mappedSource = map.sources[0].startsWith('file:') ? fileURLToPath(map.sources[0]) : path.resolve(path.dirname(module.runtime), map.sources[0]);
    assert.equal(path.resolve(mappedSource), path.resolve(module.source), 'Source path mismatch');
    assert.equal(map.sourcesContent[0], source, 'Source content mismatch');
    const url = pathToFileURL(module.runtime).href;
    const matches = raw.result.filter(script => urlKey(script.url) === url);
    assert.ok(matches.length <= 1, 'Duplicate runtime coverage');
    return { ...module, url: matches[0]?.url ?? url, coverage: matches.length ? mapCoverage(code, map, matches[0]) : null };
  });
  const runtime = measured.filter(module => !/(selfcheck|[.]test|[.]spec)[.]tsx?$/i.test(module.sourceName));
  const perFile = Object.fromEntries(runtime.flatMap(module => Object.entries(module.coverage?.perFile ?? {})));
  assert.equal(Object.keys(perFile).length, runtime.reduce((total, module) => total + Object.keys(module.coverage?.perFile ?? {}).length, 0), 'Duplicate source compilation');
  const metric = (covered, total, description) => ({ metric: description, covered, total, ratio: total ? covered / total : null });
  const files = Object.values(perFile);
  return {
    modules: measured,
    missingRuntimeModules: measured.filter(module => !module.coverage).map(module => module.sourceName),
    exclusions: {
      testSources: measured.filter(module => !runtime.includes(module)).map(module => module.sourceName),
      outsideRuntimeScope: raw.result.filter(script => !measured.some(module => urlKey(module.url) === urlKey(script.url))).map(script => script.url),
      policy: 'Node internals, dependencies, harness, test/self-check sources and non-emitted application modules excluded from aggregate; test and unmapped evidence retained per module.',
    },
    perFile,
    lineCoverage: metric(files.reduce((total, file) => total + file.covered, 0), files.reduce((total, file) => total + file.total, 0), 'mapped executable source-line coverage'),
    functionCoverage: metric(files.reduce((total, file) => total + file.hitFunctions, 0), files.reduce((total, file) => total + file.observedFunctions, 0), 'mapped observed V8 function coverage'),
    branchCoverage: { status: 'UNMEASURED', reason: 'V8 block ranges are not a conventional source branch census.' },
  };
}

function collect() {
  assert.ok(Number(process.versions.node.split('.')[0]) >= 22, 'Node.js 22+ required');
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'thienmenh-unit-coverage-'));
  try {
    const runtimeRoot = path.join(temporary, 'runtime');
    const coverageRoot = path.join(temporary, 'coverage');
    const program = ts.createProgram([path.join(root, entry)], {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.Node10, skipLibCheck: true,
      esModuleInterop: true, sourceMap: true, inlineSources: true,
      rootDir: path.join(root, 'src'), outDir: runtimeRoot, noEmitOnError: true,
    });
    const diagnostics = ts.getPreEmitDiagnostics(program);
    assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: file => file, getCurrentDirectory: () => root, getNewLine: () => '\n',
    }));
    const emitted = [];
    const result = program.emit(undefined, (file, content, bom, onError, sources) => {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content);
      if (file.endsWith('.js')) {
        assert.equal(sources?.length, 1, 'Expected one source per runtime module');
        emitted.push({ runtime: file, source: path.resolve(sources[0].fileName), sourceName: name(sources[0].fileName) });
      }
    });
    assert.ok(!result.emitSkipped && emitted.length, 'Compilation did not emit runtime modules');
    fs.writeFileSync(path.join(runtimeRoot, 'package.json'), '{"type":"commonjs"}');
    fs.mkdirSync(coverageRoot);
    const modules = emitted.map(module => ({ ...module,
      codeHash: hash(fs.readFileSync(module.runtime)),
      mapHash: hash(fs.readFileSync(module.runtime + '.map')),
      sourceHash: hash(fs.readFileSync(module.source)),
    }));
    const runtimeEntry = path.join(runtimeRoot, 'game/ui/rpgMenuSelfCheck.js');
    execFileSync(process.execPath, ['-e', 'if (require(' + JSON.stringify(runtimeEntry) + ').RPG_MENU_SELF_CHECK_PASSED !== true) throw new Error("RPG menu self-check failed")'], {
      cwd: root, stdio: 'inherit', env: { ...process.env, NODE_V8_COVERAGE: coverageRoot }, timeout: 30000,
    });
    const rawFiles = fs.readdirSync(coverageRoot).filter(file => /^coverage-.*\.json$/.test(file));
    assert.equal(rawFiles.length, 1, 'Expected one child native coverage snapshot');
    const rawText = fs.readFileSync(path.join(coverageRoot, rawFiles[0]), 'utf8');
    const evidence = {
      schemaVersion: 1, createdAt: new Date().toISOString(), node: process.version, typescript: ts.version,
      scope: { entry, sources: modules.map(module => module.sourceName).sort(), denominator: 'Only emitted runtime dependency-closure sources observed by the child; test/self-check and missing modules excluded from aggregate denominators, retained as explicit evidence.', fullRepository: false, acceptance80Percent: 'NOT_ESTABLISHED' },
      compilation: { target: 'ES2022', module: 'CommonJS', sourceMap: true, inlineSources: true },
      rawCoverage: { file: rawFiles[0], sha256: hash(rawText), snapshots: 1 },
      ...mapRuntime(JSON.parse(rawText), modules),
      limitations: ['One child, one compilation. Each exact runtime URL is mapped independently against its captured JS/map/source hashes; generated offsets are never combined between modules or compilations.', 'Source lines are mapped observed executable spans, not an AST census. Functions use observed V8 first-range hits; unmapped functions remain excluded. No whole-repository or 80% acceptance claim.'],
    };
    const output = path.join(root, 'artifacts/unit-coverage/rpg-menu.json');
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(evidence, null, 2) + '\n');
    console.log('RPG menu coverage: lines ' + evidence.lineCoverage.covered + '/' + evidence.lineCoverage.total + ', functions ' + evidence.functionCoverage.covered + '/' + evidence.functionCoverage.total + ', missing runtime modules ' + evidence.missingRuntimeModules.length + '; branches UNMEASURED');
    return evidence;
  } finally {
    removeTemp(temporary);
  }
}

module.exports = { mapRuntime, removeTemp };
if (require.main === module) collect();
