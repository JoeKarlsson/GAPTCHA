// Copies public/ to dist/ and adds a content hash (?v=…) to every local CSS and JS URL,
// in the HTML and in the import lines between JS modules, so a deploy never mixes new
// HTML with a stale cached script. A module's hash covers the hashes of what it imports.
import { createHash } from 'node:crypto';
import { cpSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const shortHash = (text) => createHash('sha256').update(text).digest('hex').slice(0, 10);

// Matches relative module specifiers: import … from './x.js', import('./x.js'), export … from './x.js'
const IMPORT_PATTERN = /(\bfrom\s*|\bimport\s*\(?\s*)(['"])(\.\.?\/[^'"?]+\.js)\2/g;
// Matches local href/src attributes pointing at css/ or js/, with or without a leading slash
const HTML_ASSET_PATTERN = /\b(href|src)=(["'])(\/?(?:css|js)\/[^"'?]+\.(?:css|js))\2/g;

/** Rewrites one module's relative imports, tagging each with its target's hash. */
export function rewriteImports(source, fromPath, hashOf) {
	return source.replace(IMPORT_PATTERN, (match, prefix, quote, specifier) => {
		const target = posix.normalize(posix.join(posix.dirname(fromPath), specifier));
		return `${prefix}${quote}${specifier}?v=${hashOf(target)}${quote}`;
	});
}

/** Rewrites local CSS/JS URLs in an HTML page to carry their hash. */
export function rewriteHtml(html, hashOf) {
	return html.replace(HTML_ASSET_PATTERN, (match, attribute, quote, url) => {
		return `${attribute}=${quote}${url}?v=${hashOf(url.replace(/^\//, ''))}${quote}`;
	});
}

/**
 * Hashes every file in `files` ({ 'js/a.js': source }), rewriting JS imports first, so a
 * change deep in the import graph changes every importer's hash too.
 * Returns { hashes, outputs } keyed by the same relative paths.
 */
export function hashAssets(files) {
	const hashes = {};
	const outputs = {};
	const visiting = new Set();
	const hashOf = (path) => {
		if (hashes[path]) return hashes[path];
		if (!(path in files)) throw new Error(`Unknown asset ${path}`);
		if (visiting.has(path)) throw new Error(`Import cycle through ${path}`);
		visiting.add(path);
		const output = path.endsWith('.js') ? rewriteImports(files[path], path, hashOf) : files[path];
		visiting.delete(path);
		outputs[path] = output;
		hashes[path] = shortHash(output);
		return hashes[path];
	};
	Object.keys(files).forEach(hashOf);
	return { hashes, outputs };
}

function build(source = 'public', destination = 'dist') {
	rmSync(destination, { recursive: true, force: true });
	cpSync(source, destination, { recursive: true });
	const files = {};
	for (const directory of ['css', 'js']) {
		for (const name of readdirSync(join(destination, directory))) {
			if (/\.(css|js)$/.test(name)) files[`${directory}/${name}`] = readFileSync(join(destination, directory, name), 'utf8');
		}
	}
	const { hashes, outputs } = hashAssets(files);
	for (const [path, output] of Object.entries(outputs)) writeFileSync(join(destination, path), output);
	for (const name of readdirSync(destination).filter((file) => file.endsWith('.html'))) {
		const page = join(destination, name);
		writeFileSync(page, rewriteHtml(readFileSync(page, 'utf8'), (path) => {
			if (!hashes[path]) throw new Error(`${name} links ${path}, which doesn't exist`);
			return hashes[path];
		}));
	}
	console.log(`Built ${destination}/ with ${Object.keys(hashes).length} hashed CSS and JS files`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) build();
