/*
	The WCAG 2.2 AA contrast commitment, and the only thing enforcing it anywhere.

	axe-core cannot check contrast without a real browser and fails *open* — under jsdom
	it reports a pass for anything it considers not visible on screen. So this test, not
	layer 3, carries the commitment (design-direction.md §6).

	It parses tokens.css off disk, so the values under test are literally the values that
	ship, and it fails closed: every colour token must appear in a classification list.
*/
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/* WCAG 2.2 SC 1.4.3 (text) and 1.4.11 (non-text). The standard, not the palette's headroom. */
const AA_TEXT = 4.5;
const AA_UI = 3;

const GROUNDS = ['--paper', '--surface', '--raised', '--inset', '--hover', '--selected'];
const TEXT = ['--ink', '--ink-mute', '--accent', '--danger'];
const UI = ['--control', '--focus'];
const DECORATIVE = ['--rule', '--rule-hard', '--scrim'];

/*
	Explicit pairs, not matrix grounds. --accent-hover is one button state; adding it to
	GROUNDS would widen universal AA to seven grounds for that one state.
*/
const EXPLICIT_PAIRS: [string, string][] = [
	['--on-accent', '--accent'],
	['--on-accent', '--accent-hover']
];

/* "At least one", not "exactly one": --accent is both a text colour and a button ground. */
const CLASSIFIED = new Set([...GROUNDS, ...TEXT, ...UI, ...DECORATIVE, ...EXPLICIT_PAIRS.flat()]);

const COLOUR_TOKEN =
	/(--[a-z0-9-]+)\s*:\s*light-dark\(\s*(#[0-9a-f]{3,8})\s*,\s*(#[0-9a-f]{3,8})\s*\)/gi;

/** A token whose value carries no light-dark() is a size, and is ignored by rule. */
function readColourTokens(css: string): Map<string, [string, string]> {
	const declarations = css.replace(/\/\*[\s\S]*?\*\//g, '');
	const tokens = new Map<string, [string, string]>();
	for (const [, name, light, dark] of declarations.matchAll(COLOUR_TOKEN)) {
		tokens.set(name, [light, dark]);
	}
	return tokens;
}

function themePalette(
	tokens: Map<string, [string, string]>,
	position: 0 | 1
): Map<string, string> {
	return new Map([...tokens].map(([name, pair]) => [name, pair[position]]));
}

function colour(palette: Map<string, string>, token: string): string {
	const value = palette.get(token);
	if (value === undefined) throw new Error(`No such colour token in tokens.css: ${token}`);
	return value;
}

function channels(hex: string): [number, number, number] {
	const digits = hex.replace('#', '');
	const full = digits.length === 3 ? digits.replace(/./g, (digit) => digit + digit) : digits;
	if (!/^[0-9a-f]{6}$/i.test(full)) {
		throw new Error(`Not an opaque sRGB hex, so it has no contrast ratio: ${hex}`);
	}
	return [0, 2, 4].map((at) => parseInt(full.slice(at, at + 2), 16) / 255) as [
		number,
		number,
		number
	];
}

function toLinear(channel: number): number {
	return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
	const [red, green, blue] = channels(hex).map(toLinear);
	return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(one: string, other: string): number {
	const [lighter, darker] = [relativeLuminance(one), relativeLuminance(other)].sort(
		(a, b) => b - a
	);
	return (lighter + 0.05) / (darker + 0.05);
}

function everyPair(inks: string[], grounds: string[]): [string, string][] {
	return inks.flatMap((ink) => grounds.map((ground): [string, string] => [ink, ground]));
}

const colourTokens = readColourTokens(
	readFileSync(new URL('./tokens.css', import.meta.url), 'utf8')
);

describe('the classification', () => {
	it('covers every colour token in tokens.css', () => {
		const unclassified = [...colourTokens.keys()].filter((name) => !CLASSIFIED.has(name));

		expect(unclassified).toEqual([]);
	});

	it('names no token tokens.css does not declare', () => {
		const missing = [...CLASSIFIED].filter((name) => !colourTokens.has(name));

		expect(missing).toEqual([]);
	});
});

describe.each([
	['light', 0],
	['dark', 1]
] as const)('the %s theme', (_theme, position) => {
	const palette = themePalette(colourTokens, position);

	it.each(everyPair(TEXT, GROUNDS))('reads %s on %s at 4.5:1', (ink, ground) => {
		const ratio = contrastRatio(colour(palette, ink), colour(palette, ground));

		expect(ratio).toBeGreaterThanOrEqual(AA_TEXT);
	});

	it.each(everyPair(UI, GROUNDS))('separates %s from %s at 3:1', (line, ground) => {
		const ratio = contrastRatio(colour(palette, line), colour(palette, ground));

		expect(ratio).toBeGreaterThanOrEqual(AA_UI);
	});

	it.each(EXPLICIT_PAIRS)('reads %s on %s at 4.5:1', (ink, ground) => {
		const ratio = contrastRatio(colour(palette, ink), colour(palette, ground));

		expect(ratio).toBeGreaterThanOrEqual(AA_TEXT);
	});
});
