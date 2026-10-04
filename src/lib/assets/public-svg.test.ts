/* eslint-disable security/detect-non-literal-fs-filename -- every path is built from this repo's own public/ directory listing, never from input. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every SVG under `public/` must be well-formed XML.
 *
 * WHY. `public/images/placeholder/product.svg` had `--surface-container-high`
 * inside an XML comment. `--` is illegal inside a comment, so browsers
 * refused to render the file, and because it is the fallback for every
 * product photo, every product on the live site showed a broken image.
 * A server returning it with 200 hid the problem from every other check.
 */
function listSvgs(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return listSvgs(full);
    return name.endsWith(".svg") ? [full] : [];
  });
}

const svgs = listSvgs(path.resolve(__dirname, "../../../public"));

describe("public SVG assets", () => {
  it("finds the product placeholder", () => {
    expect(svgs.some((file) => file.endsWith(path.join("placeholder", "product.svg")))).toBe(true);
  });

  it.each(svgs)("%s has no '--' inside an XML comment", (file) => {
    const comments = readFileSync(file, "utf8").match(/<!--([\s\S]*?)-->/g) ?? [];
    for (const comment of comments) {
      const body = comment.slice(4, -3);
      expect(body.includes("--"), `"--" inside a comment in ${file}`).toBe(false);
      expect(body.endsWith("-"), `comment ends with "-" in ${file}`).toBe(false);
    }
  });

  it.each(svgs)("%s starts with an <svg> or XML declaration", (file) => {
    expect(readFileSync(file, "utf8").trimStart()).toMatch(/^(<\?xml|<svg)/);
  });
});
