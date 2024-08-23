import { defineAkteApp } from "akte";

import { index } from "./src/pages/index.js";
import { sitemap } from "./src/pages/sitemap.js";
import { postsSlug } from "./src/pages/posts/slug.js";
import { catchAll } from "./src/pages/catchAll/index.js";

export const app = defineAkteApp({
	// files: [],
	files: [index, sitemap, postsSlug, catchAll],
	globalData: () => {
		return 1;
	},
});
