import { defineAkteFiles } from "../../src/index.js";

export const jsons = defineAkteFiles().from({
	path: "/:slug.json",
	bulkData() {
		const jsons = {
			"/foo.json": "foo",
			"/bar.json": "bar",
			"/baz.json": "bar",
		};

		return jsons;
	},
	render(context) {
		return `Rendered: ${JSON.stringify(context)}`;
	},
});
