import { AkteViteCache } from "./AkteViteCache.js";

export const createAkteViteCache = (root: string): AkteViteCache => {
	return new AkteViteCache(root);
};
