export interface FunctionDefinition {
	name: string;
	interface: string;
	description: string;
	keywords: string[];
}

export interface Reference {
	code: string;
	url: string;
	author: string;
	license: string;
}

export interface Piece {
	func: FunctionDefinition;
	code: string;
}
