import { pathToFilePath } from "./pathToFilePath.js";

export const pathToRouterPath = (path: string): string => {
	const filePath = pathToFilePath(path);

	return filePath.replace(/^(.*?)\.(.*)$/, "/.akte/$2$1").replaceAll("//", "/");
};
