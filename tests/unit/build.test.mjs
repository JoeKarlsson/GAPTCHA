import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashAssets, rewriteHtml } from '../../scripts/build.mjs';

test('a module hash changes when something it imports changes', () => {
	const files = {
		'js/a.js': "import { b } from './b.js';\nb();",
		'js/b.js': "import { c } from './c.js';\nexport const b = c;",
		'js/c.js': 'export const c = () => 1;',
	};
	const before = hashAssets(files);
	const after = hashAssets({ ...files, 'js/c.js': 'export const c = () => 2;' });
	assert.match(before.outputs['js/a.js'], /from '\.\/b\.js\?v=[0-9a-f]{10}'/);
	assert.notEqual(before.hashes['js/a.js'], after.hashes['js/a.js']);
	assert.equal(before.hashes['js/b.js'] === after.hashes['js/b.js'], false);
});

test('unchanged files keep their hash between builds', () => {
	const files = { 'css/site.css': 'body { color: red; }' };
	assert.equal(hashAssets(files).hashes['css/site.css'], hashAssets(files).hashes['css/site.css']);
});

test('HTML links with and without a leading slash get the hash; CDN URLs are left alone', () => {
	const html = '<link rel="stylesheet" href="css/a.css"><link href="/css/a.css"><script src="https://cdn.example/x.js"></script>';
	assert.equal(
		rewriteHtml(html, () => 'abc'),
		'<link rel="stylesheet" href="css/a.css?v=abc"><link href="/css/a.css?v=abc"><script src="https://cdn.example/x.js"></script>',
	);
});

test('an import of a file that does not exist fails the build', () => {
	assert.throws(() => hashAssets({ 'js/a.js': "import './missing.js';" }), /Unknown asset js\/missing\.js/);
});
