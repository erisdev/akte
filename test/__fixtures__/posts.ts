import { defineAkteFiles } from "../../src/index.js";

export const posts = defineAkteFiles().from({
	path: "/posts/:slug",
	bulkData() {
		const posts = {
			"/posts/foo": "foo",
			"/posts/bar": "bar",
			"/posts/baz": "bar",
		};

		return posts;
	},
	render(context) {
		return `Rendered: ${JSON.stringify(context)}`;
	},
});
