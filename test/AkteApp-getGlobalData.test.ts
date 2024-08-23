import { expect, it, vi } from "vitest";

import { defineAkteApp } from "../src/index.js";

import { index } from "./__fixtures__/index.js";
import { about } from "./__fixtures__/about.js";
import { pages } from "./__fixtures__/pages.js";
import { posts } from "./__fixtures__/posts.js";
import { jsons } from "./__fixtures__/jsons.js";

it("caches global data", async () => {
	const globalDataFn = vi.fn().mockImplementation(() => true);

	const app = defineAkteApp({
		files: [index, about, pages, posts, jsons],
		globalData: globalDataFn,
	});

	app.getGlobalData();
	app.getGlobalData();

	expect(globalDataFn).toHaveBeenCalledOnce();
});

it("caches global data promise", async () => {
	const globalDataFn = vi.fn().mockImplementation(() => Promise.resolve(true));

	const app = defineAkteApp({
		files: [index, about, pages, posts, jsons],
		globalData: globalDataFn,
	});

	app.getGlobalData();
	app.getGlobalData();

	expect(globalDataFn).toHaveBeenCalledOnce();
});
