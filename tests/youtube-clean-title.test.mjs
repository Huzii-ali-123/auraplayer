import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/youtube/cleanTitle.ts', import.meta.url), 'utf8');
const javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const { cleanVideoMetadata, parseIsoDuration } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`);

test('cleans common video decoration and splits artist-title metadata', () => {
  assert.deepEqual(cleanVideoMetadata('Artist Name - Song Name (Official Video) [4K] | HD', 'Uploader'), {
    title: 'Song Name', artist: 'Artist Name'
  });
});

test('removes feature tails and derives topic channel artist', () => {
  assert.deepEqual(cleanVideoMetadata('Song Name ft. Guest Artist (Lyrics)', 'Main Artist - Topic'), {
    title: 'Song Name', artist: 'Main Artist'
  });
});

test('parses YouTube ISO 8601 durations into milliseconds', () => {
  assert.equal(parseIsoDuration('PT1H2M3S'), 3723000);
  assert.equal(parseIsoDuration('PT4M12S'), 252000);
  assert.equal(parseIsoDuration('not-a-duration'), 0);
});
