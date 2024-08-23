import { defineAkteFiles } from "../../src/index.js";

export const renderError = defineAkteFiles().from({
	path: "/render-error/:slug",
	bulkData() {
		throw new Error("render error");
	},
	render(context) {
		return `Rendered: ${JSON.stringify(context)}`;
	},
});
