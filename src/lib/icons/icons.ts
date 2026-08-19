/*
	Lucide geometry re-cut for butt caps and miter joins: dot-shaped commands (`h.01`)
	render as nothing without round caps, so they become short dashes, and every rounded
	rectangle and circle is spelled as a path so a shape is always a list of `d` strings.
	The set is open and keyed by shape name — extend it from the Aktionsvokabular rather
	than picking a glyph ad hoc.
*/
export const iconPaths = {
	pencil: ['M4 20h4L20 8a2.83 2.83 0 0 0-4-4L4 16z', 'm14 6 4 4', 'M4 16v4h4'],
	'trash-2': [
		'M3 6h18',
		'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6',
		'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
		'M10 11v6M14 11v6'
	],
	'message-square-text': [
		'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
		'M7 8h10M7 12h6'
	],
	globe: [
		'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z',
		'M2 12h20',
		'M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z'
	],
	calendar: [
		'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
		'M16 2v4M8 2v4M3 10h18'
	],
	plus: ['M5 12h14M12 5v14'],
	copy: [
		'M10 8h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z',
		'M16 8V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4'
	],
	search: ['M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0z', 'm21 21-4.3-4.3'],
	'file-input': [
		'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z',
		'M14 2v5h5M2 15h7M6 12l3 3-3 3'
	],
	'file-output': [
		'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z',
		'M14 2v5h5M9 15H2M5 12l-3 3 3 3'
	],
	download: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'm7 10 5 5 5-5', 'M12 15V3'],
	'sliders-horizontal': ['M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4'],
	users: [
		'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
		'M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
		'M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8'
	],
	'user-plus': [
		'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
		'M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
		'M19 8v6M22 11h-6'
	],
	'calendar-days': [
		'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
		'M16 2v4M8 2v4M3 10h18',
		'M8 14h1M12 14h1M16 14h1M8 18h1M12 18h1'
	],
	'calendar-plus': [
		'M21 13V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8',
		'M16 2v4M8 2v4M3 10h18',
		'M16 19h6M19 16v6'
	],
	library: ['m16 6 4 14M12 6v14M8 8v12M4 4v16'],
	link: [
		'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71',
		'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'
	],
	ban: ['M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z', 'm4.9 4.9 14.2 14.2'],
	'arrow-up': ['M12 19V5', 'm5 12 7-7 7 7'],
	'arrow-down': ['M12 5v14', 'm19 12-7 7-7-7'],
	'chevron-right': ['m9 18 6-6-6-6'],
	'chevron-down': ['m6 9 6 6 6-6'],
	x: ['M18 6 6 18M6 6l12 12'],
	'triangle-alert': [
		'm21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z',
		'M12 9v4M12 16.5v1.5'
	]
} as const;

export type IconName = keyof typeof iconPaths;
