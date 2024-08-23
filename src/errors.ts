/**
 * Indicates that the file could not be rendered. If the `cause` property is
 * undefined, this error can be considered as a pure 404, otherwise it can be a
 * 500.
 */
export class NotFoundError extends Error {
	path: string;

	// This property already exists on Error, but TypeScript is unaware
	declare cause?: unknown;

	constructor(
		path: string,
		options?: {
			cause?: unknown;
		},
	) {
		const cause = options?.cause;
		let message = `Could lookup file for path \`${path}\``;

		if (cause) {
			message += `\n\n${cause.toString()}`;
		}

		// @ts-expect-error - TypeScript doesn't know Node 16 has the two argument Error constructor
		super(message, options);

		this.path = path;
	}
}
