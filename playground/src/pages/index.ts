import { defineAkteFile } from "akte";
import { basic } from "../layouts/basic.js";

export const index = defineAkteFile<unknown, number>().from({
	path: "/",
	async data() {
		await new Promise((resolve) => setTimeout(resolve, 2000));

		return 1;
	},
	render: (context) => {
		const slot = /* html */ `<main>index ${JSON.stringify(context)}</main>`;

		return basic(slot);
	},
});
