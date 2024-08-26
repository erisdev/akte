import { defineAkteFile } from "../../src/index.js";

export const about = defineAkteFile().from({
	path: "/about",
	render(context) {
		return `Rendered: ${JSON.stringify(context)}`;
	},
});
