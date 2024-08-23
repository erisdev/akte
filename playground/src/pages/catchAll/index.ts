import { defineAkteFiles } from "akte";
import { basic } from "../../layouts/basic.js";

export const catchAll = defineAkteFiles<unknown>().from({
	path: "/catch-all/**",
	bulkData() {
		return {
			"/catch-all": {},
			"/catch-all/foo": {},
			"/catch-all/foo/bar": {},
			"/catch-all/foo/bar/baz": {},
		};
	},
	render: (context) => {
		const slot = /* html */ `<main>${context.path}</main>`;

		return basic(slot);
	},
});
