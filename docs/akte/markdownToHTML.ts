import { type Plugin, type Processor, unified } from "unified";

import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import { type VFile, matter } from "vfile-matter";
import remarkDirective from "remark-directive";
import remarkRehype from "remark-rehype";

import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeToc from "rehype-toc";
import rehypeStringify from "rehype-stringify";

import { common, createStarryNight } from "@wooorm/starry-night";
import { visit } from "unist-util-visit";
import { toString } from "hast-util-to-string";
import { h } from "hastscript";
import type { ElementContent, Root as HRoot } from "hast";
import type { Root as MDRoot } from "mdast";

const rehypeStarryNight: Plugin<[], HRoot> = () => {
	const starryNightPromise = createStarryNight(common);
	const prefix = "language-";

	return async (tree) => {
		const starryNight = await starryNightPromise;

		visit(tree, "element", (node, index, parent) => {
			if (!parent || index === null || node.tagName !== "pre") {
				return;
			}

			const head = node.children[0];

			if (
				!head ||
				head.type !== "element" ||
				head.tagName !== "code" ||
				!head.properties
			) {
				return;
			}

			const classes = head.properties.className;

			if (!Array.isArray(classes)) {
				return;
			}

			const language = classes.find(
				(d) => typeof d === "string" && d.startsWith(prefix),
			);

			if (typeof language !== "string") {
				return;
			}

			const scope = starryNight.flagToScope(language.slice(prefix.length));

			// Maybe warn?
			if (!scope) {
				return;
			}

			const fragment = starryNight.highlight(toString(head), scope);
			const children = fragment.children as ElementContent[];

			parent.children.splice(index, 1, {
				type: "element",
				tagName: "figure",
				properties: {
					className: [
						"highlight",
						`highlight-${scope.replace(/^source\./, "").replace(/\./g, "-")}`,
					],
				},
				children: [
					{ type: "element", tagName: "pre", properties: {}, children },
				],
			});
		});
	};
};

let processor: Processor;

export const markdownToHTML = async <TMatter extends Record<string, unknown>>(
	markdown: string,
): Promise<{
	matter: TMatter;
	html: string;
}> => {
	if (!processor) {
		processor = unified()
			.use(remarkParse)
			.use(remarkGfm)
			.use(remarkFrontmatter, ["yaml"])
			.use(() => (_: MDRoot, file: VFile) => {
				matter(file);
			})
			.use(remarkDirective)
			.use(() => (tree: MDRoot) => {
				visit(tree, (node) => {
					if (
						node.type === "textDirective" ||
						node.type === "leafDirective" ||
						node.type === "containerDirective"
					) {
						if (node.name === "callout") {
							const data = node.data || (node.data = {});
							const tagName =
								node.type === "textDirective" ? "span" : "article";

							data.hName = tagName;
							const properties = h(tagName, node.attributes).properties || {};
							properties.className ||= [];
							(properties.className as string[]).push("callout");

							if (properties.icon) {
								properties.dataIcon = properties.icon;
								delete properties.icon;
							}

							const children = node.children;
							if (properties.title) {
								const title = properties.title;
								delete properties.title;

								children.unshift({
									type: "heading",
									depth: properties.level || 4,
									children: [{ type: "text", value: title }],
								});
							}
							delete properties.level;

							node.children = [
								{
									type: "div",
									children,
								},
							];

							data.hProperties = properties;
						}
					}
				});
			})
			.use(remarkRehype, { allowDangerousHtml: true })

			.use(rehypeSlug)
			.use(rehypeAutolinkHeadings, { behavior: "wrap" })
			.use(rehypeToc, {
				headings: ["h2", "h3"],
				cssClasses: {
					list: "",
					listItem: "",
					link: "",
				},
			})
			.use(() => (tree: HRoot, file: VFile) => {
				// Extract nav and wrap article
				if (
					tree.children[0].type === "element" &&
					tree.children[0].tagName === "nav"
				) {
					const [nav, ...children] = tree.children;
					tree.children = [];

					if (file.data.matter.toc !== false) {
						tree.children.push(nav);
					}

					tree.children.push({
						type: "element",
						tagName: "main",
						children,
					});
				}

				visit(tree, "element", (node, index, parent) => {
					if (!parent || index === null) {
						return;
					}

					switch (node.tagName) {
						case "nav":
							node.children.unshift({
								type: "element",
								tagName: "h2",
								children: [
									{
										type: "text",
										value: "Table of Contents",
									},
								],
							});

							return;

						case "a":
							if (
								typeof node.properties?.href === "string" &&
								/^https?:\/\//.test(node.properties.href)
							) {
								node.properties.target = "_blank";
								node.properties.rel = "noopener noreferrer";
							}

						default:
					}
				});
			})

			.use(rehypeStarryNight)
			.use(rehypeStringify, { allowDangerousHtml: true });
	}
	const virtualFile = await processor.process(markdown);

	return {
		matter: virtualFile.data.matter as TMatter,
		html: virtualFile.toString(),
	};
};
