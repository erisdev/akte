import { defineAkteApp } from "akte";

import { version } from "../package.json";

import { pages } from "./files/pages.js";
import { sitemap } from "./files/sitemap.js";

export const app = defineAkteApp({
	files: [pages, sitemap],
	globalData() {
		return {
			version,
		};
	},
});
