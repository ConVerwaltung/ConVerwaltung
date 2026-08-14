/*
	Lucide geometry re-cut for butt caps and miter joins: dot-shaped commands (`h.01`)
	render as nothing without round caps, so they become short dashes, and the rounded
	rectangle of `calendar-days` is spelled as a path so every shape is a list of `d`
	strings. The set is open and keyed by shape name — extend it from the
	Aktionsvokabular rather than picking a glyph ad hoc.
*/
export const iconPaths = {
	users: [
		'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
		'M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
		'M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8'
	],
	'sliders-horizontal': ['M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4'],
	'file-input': [
		'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z',
		'M14 2v5h5M2 15h7M6 12l3 3-3 3'
	],
	'file-output': [
		'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z',
		'M14 2v5h5M9 15H2M5 12l-3 3 3 3'
	],
	'calendar-days': [
		'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
		'M16 2v4M8 2v4M3 10h18',
		'M8 14h1M12 14h1M16 14h1M8 18h1M12 18h1'
	],
	library: ['m16 6 4 14M12 6v14M8 8v12M4 4v16']
} as const;

export type IconName = keyof typeof iconPaths;
