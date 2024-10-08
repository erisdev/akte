import { dirname, join, resolve } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

import { type MatchedRoute, type RadixRouter, createRouter } from "radix3";

import type { AkteFiles } from "./AkteFiles.js";
import type { Awaitable, GlobalDataFn } from "./types.js";
import { NotFoundError } from "./errors.js";
import { runCLI } from "./runCLI.js";
import { akteWelcome } from "./akteWelcome.js";

import { __PRODUCTION__ } from "./lib/__PRODUCTION__.js";
import { createDebugger } from "./lib/createDebugger.js";
import { pathToRouterPath } from "./lib/pathToRouterPath.js";
import { isCLI } from "./lib/isCLI.js";

/* eslint-disable @typescript-eslint/no-unused-vars, unused-imports/no-unused-imports */

import type { defineAkteFile } from "./defineAkteFile.js";
import type { defineAkteFiles } from "./defineAkteFiles.js";

/* eslint-enable @typescript-eslint/no-unused-vars, unused-imports/no-unused-imports */

/** Akte app configuration object. */
export type Config<TGlobalData> = {
	/**
	 * Akte files this config is responsible for.
	 *
	 * Create them with {@link defineAkteFile} and {@link defineAkteFiles}.
	 */
	files: AkteFiles<TGlobalData>[];

	/** Configuration related to Akte build process. */
	build?: {
		/**
		 * Output directory for Akte build command.
		 *
		 * @remarks
		 *   This directory is overriden by the Akte Vite plugin when running Akte
		 *   through Vite.
		 * @defaultValue `"dist"` for Akte build command, `".akte"` for Akte Vite plugin.
		 */
		outDir?: string;
	};
	// Most global data will eventually be objects we use this
	// assumption to make mandatory or not the `globalData` method
} & (TGlobalData extends Record<string | number | symbol, unknown>
	? {
			/**
			 * Global data retrieval function.
			 *
			 * The return value of this function is then shared with each Akte file.
			 */
			globalData: GlobalDataFn<TGlobalData>;
		}
	: {
			/**
			 * Global data retrieval function.
			 *
			 * The return value of this function is then shared with each Akte file.
			 */
			globalData?: GlobalDataFn<TGlobalData>;
		});

const debug = createDebugger("akte:app");
const debugWrite = createDebugger("akte:app:write");
const debugRender = createDebugger("akte:app:render");
const debugRouter = createDebugger("akte:app:router");
const debugCache = createDebugger("akte:app:cache");

/** An Akte app, ready to be interacted with. */
export class AkteApp<TGlobalData = unknown> {
	protected config: Config<TGlobalData>;

	/**
	 * Readonly array of {@link AkteFiles} registered within the app.
	 *
	 * @experimental Programmatic API might still change not following SemVer.
	 */
	get files(): AkteFiles<TGlobalData>[] {
		return this.config.files;
	}

	constructor(config: Config<TGlobalData>) {
		if (!__PRODUCTION__) {
			if (config.files.length === 0 && akteWelcome) {
				config.files.push(akteWelcome);
			}
		}

		this.config = config;

		debug("defined with %o files", this.config.files.length);

		if (isCLI) {
			runCLI(this as AkteApp);
		}
	}

	/**
	 * Looks up the Akte file responsible for rendering the path.
	 *
	 * @param path - Path to lookup, e.g. "/foo"
	 * @returns A match featuring the path, the path parameters if any, and the
	 *   Akte file.
	 * @throws a {@link NotFoundError} when no Akte file is found for handling
	 *   looked up path.
	 * @experimental Programmatic API might still change not following SemVer.
	 */
	lookup(path: string): MatchedRoute<{
		file: AkteFiles<TGlobalData>;
	}> & { path: string } {
		const pathWithExtension = pathToRouterPath(path);
		debugRouter("looking up %o (%o)", path, pathWithExtension);

		const maybeMatch = this.getRouter().lookup(pathWithExtension);

		if (!maybeMatch || !maybeMatch.file) {
			debugRouter("not found %o", path);
			throw new NotFoundError(path);
		}

		return {
			...maybeMatch,
			path,
		};
	}

	/**
	 * Renders a match from {@link lookup}.
	 *
	 * @param match - Match to render.
	 * @returns Rendered file.
	 * @throws a {@link NotFoundError} when the Akte file could not render the match
	 *   (404), with an optional `cause` attached to it for uncaught errors (500)
	 * @experimental Programmatic API might still change not following SemVer.
	 */
	async render(
		match: MatchedRoute<{
			file: AkteFiles<TGlobalData>;
		}> & { path: string; globalData?: TGlobalData; data?: unknown },
	): Promise<string> {
		debugRender("rendering %o...", match.path);

		const params: Record<string, string> = match.params || {};
		const globalData = match.globalData || (await this.getGlobalData());

		try {
			const content = await match.file.render({
				path: match.path,
				params,
				globalData,
				data: match.data,
			});

			debugRender("rendered %o", match.path);

			return content;
		} catch (error) {
			if (error instanceof NotFoundError) {
				throw error;
			}

			debugRender("could not render %o", match.path);

			throw new NotFoundError(match.path, { cause: error });
		}
	}

	/**
	 * Renders all Akte files.
	 *
	 * @returns Rendered files map.
	 * @experimental Programmatic API might still change not following SemVer.
	 */
	async renderAll(): Promise<Record<string, string>> {
		debugRender("rendering all files...");

		const globalData = await this.getGlobalData();

		const renderAll = async (
			akteFiles: AkteFiles<TGlobalData>,
		): Promise<Record<string, string>> => {
			try {
				const files = await akteFiles.renderAll({ globalData });

				return files;
			} catch (error) {
				debug.error("Akte → Failed to build %o\n", akteFiles.path);

				throw error;
			}
		};

		const promises: Promise<Record<string, string>>[] = [];
		for (const akteFiles of this.config.files) {
			promises.push(renderAll(akteFiles));
		}

		const rawFilesArray = await Promise.all(promises);

		const files: Record<string, string> = {};
		for (const rawFiles of rawFilesArray) {
			for (const path in rawFiles) {
				if (path in files) {
					debug.warn(
						"  Multiple files built %o, only the first one is preserved",
						path,
					);
					continue;
				}

				files[path] = rawFiles[path];
			}
		}

		const rendered = Object.keys(files).length;
		debugRender(
			`done, %o ${rendered > 1 ? "files" : "file"} rendered`,
			rendered,
		);

		return files;
	}

	/**
	 * Writes a map of rendered Akte files to the specified `outDir`, or the app
	 * specified one (defaults to `"dist"`).
	 *
	 * @param args
	 * @param args.files - A map of rendered Akte files
	 * @param args.outDir - An optional `outDir`
	 * @experimental Programmatic API might still change not following SemVer.
	 */
	async writeAll(args: {
		outDir?: string;
		files: Record<string, string>;
	}): Promise<void> {
		debugWrite("writing all files...");
		const outDir = args.outDir ?? this.config.build?.outDir ?? "dist";
		const outDirPath = resolve(outDir);

		const controller = new AbortController();

		const write = async (path: string, content: string): Promise<void> => {
			const filePath = join(outDirPath, path);
			const fileDir = dirname(filePath);

			try {
				await mkdir(fileDir, { recursive: true });
				await writeFile(filePath, content, {
					encoding: "utf-8",
					signal: controller.signal,
				});
			} catch (error) {
				if (controller.signal.aborted) {
					return;
				}

				controller.abort();

				debug.error("Akte → Failed to write %o\n", path);

				throw error;
			}

			debugWrite("%o", path);
			debugWrite.log("  %o", path);
		};

		const promises: Promise<void>[] = [];
		for (const path in args.files) {
			promises.push(write(path, args.files[path]));
		}

		await Promise.all(promises);

		debugWrite(
			`done, %o ${promises.length > 1 ? "files" : "file"} written`,
			promises.length,
		);
	}

	/**
	 * Build (renders and write) all Akte files to the specified `outDir`, or the
	 * app specified one (defaults to `"dist"`).
	 *
	 * @param args
	 * @param args.outDir - An optional `outDir`
	 * @returns Built files array.
	 * @experimental Programmatic API might still change not following SemVer.
	 */
	async buildAll(args?: { outDir?: string }): Promise<string[]> {
		const files = await this.renderAll();
		await this.writeAll({ ...args, files });

		return Object.keys(files);
	}

	/**
	 * Akte caches all `globalData`, `data`, `bulkData` calls for performance.
	 * This method can be used to clear the cache.
	 *
	 * @param alsoClearFileCache - Also clear cache on all registered Akte files.
	 * @experimental Programmatic API might still change not following SemVer.
	 */
	clearCache(alsoClearFileCache = false): void {
		debugCache("clearing...");

		this._globalDataCache = undefined;
		this._router = undefined;

		if (alsoClearFileCache) {
			for (const file of this.config.files) {
				file.clearCache();
			}
		}

		debugCache("cleared");
	}

	/**
	 * Readonly cache of the app's definition `globalData` method.
	 *
	 * @experimental Programmatic API might still change not following SemVer.
	 */
	get globalDataCache(): Awaitable<TGlobalData> | undefined {
		return this._globalDataCache;
	}

	private _globalDataCache: Awaitable<TGlobalData> | undefined;

	/**
	 * Retrieves data from the app's definition `globalData` method.
	 *
	 * @returns Retrieved global data.
	 * @remark Returned global data may come from cache.
	 * @experimental Programmatic API might still change not following SemVer.
	 */
	getGlobalData(): Awaitable<TGlobalData> {
		if (!this._globalDataCache) {
			debugCache("retrieving global data...");
			const globalDataPromise =
				this.config.globalData?.() ?? (undefined as TGlobalData);

			if (globalDataPromise instanceof Promise) {
				globalDataPromise.then(() => {
					debugCache("retrieved global data");
				});
			} else {
				debugCache("retrieved global data");
			}

			this._globalDataCache = globalDataPromise;
		} else {
			debugCache("using cached global data");
		}

		return this._globalDataCache;
	}

	private _router:
		| RadixRouter<{
				file: AkteFiles<TGlobalData>;
		  }>
		| undefined;

	protected getRouter(): RadixRouter<{
		file: AkteFiles<TGlobalData>;
	}> {
		if (!this._router) {
			debugCache("creating router...");
			const router = createRouter<{ file: AkteFiles<TGlobalData> }>();

			for (const file of this.config.files) {
				const path = pathToRouterPath(file.path);
				router.insert(pathToRouterPath(file.path), { file });
				debugRouter("registered %o", path);
				if (file.path.endsWith("/**")) {
					const catchAllPath = pathToRouterPath(
						file.path.replace(/\/\*\*$/, ""),
					);
					router.insert(catchAllPath, {
						file,
					});
					debugRouter("registered %o", catchAllPath);
					debugCache(pathToRouterPath(file.path.replace(/\/\*\*$/, "")));
				}
			}

			this._router = router;
			debugCache("created router");
		} else {
			debugCache("using cached router");
		}

		return this._router;
	}
}
