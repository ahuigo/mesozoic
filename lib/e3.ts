import { toFileUrl } from "https://deno.land/std@0.176.0/path/mod.ts";
import {
  parse as parseImportMap,
  resolve as importMapResolve,
} from "https://esm.sh/v106/@import-maps/resolve@1.0.1/resolve.js";

// import { createLoader } from "./graph/load.ts";
import { FileBag } from "./sources/fileBag.ts";
import { IFile } from "./sources/file.ts";
import { SourceFile } from "./sources/sourceFile.ts";
import { init } from "https://deno.land/x/deno_graph@0.41.0/mod.ts";
export { createGraph } from "https://deno.land/x/deno_graph@0.41.0/mod.ts";
import { createGraph } from "https://deno.land/x/deno_graph@0.41.0/mod.ts";
import { cache } from "https://deno.land/x/cache@0.2.13/mod.ts";
import type { LoadResponse } from "https://deno.land/x/deno_graph@0.41.0/lib/types.d.ts";

const file = await cache(
  "https://deno.land/x/deno_graph@0.41.0/lib/deno_graph_bg.wasm",
);

await init({ url: toFileUrl(file.path) });

export type Target = "browser" | "deno";
export type Loader = (
  url: string,
  isDynamic?: boolean,
) => Promise<LoadResponse | undefined>;

type CreateLoaderOptions = {
  sources: FileBag;
  target: Target;
  dynamicImports: FileBag;
  // dynamicImportIgnored?: Patterns;
};
export async function loadLocalSpecifier(
  specifier: string,
  sources: FileBag,
): Promise<[LoadResponse, IFile] | []> {
  const source = sources.find((source) => {
    console.log("ahui load40:", String(source.url()), specifier);
    return String(source.url()) === specifier;
  });

  if (source) {
    console.log("ahui22:", source.url() + "");
    const content = await source.read();
    console.log("ahui23:", source.url() + "");
    const response: LoadResponse = {
      kind: "module",
      specifier: String(source.url()),
      content,
    };
    return [response, source];
  } else {
    // if (specifier == "file:///Users/ahui/www/mesozoic/foo.ts") {
    //   console.log("ahui load5:", specifier);
    //   const content = await Deno.readTextFileSync(specifier);
    //   const response: LoadResponse = {
    //     kind: "module",
    //     specifier: specifier,
    //     content,
    //   };
    // return [response, [...sources.values()][0]];
    // }
  }

  return [];
}

function createLoader(options: CreateLoaderOptions): Loader {
  const { sources } = options;

  return async function loader(specifier: string, isDynamic?: boolean) {
    console.log("loader:30:", { specifier, isDynamic });
    const [response] = await loadLocalSpecifier(specifier, sources);
    console.log("loader:46:", response);
    return response;
  };
}

let sroot = "/Users/ahui/www/mesozoic/fixture/"; //bad
sroot = "/Users/ahui/www/mesozoic/fixture/"; //bad
// sroot = "/Users/ahui/www/mesozoic/fixture"; //good
const entryPath = sroot.replace(/\/$/, "") + "/client.tsx";
const referrer = "file://" + entryPath;
const importMap = {
  "imports": {
    "ultra/": "../",
  },
};
const baseURL = new URL("file://" + sroot);
//fix
// baseURL.pathname = baseURL.pathname.replace(/\/?$/, "/");
const parsedImportMap = parseImportMap(importMap, baseURL);
function importMapResolver(specifier: string, referrer: string) {
  if (1 > 3) {
    const r = {
      "react/jsx-runtime": "react/jsx-runtime",
      "ultra/hydrate.js": "file:///Users/ahui/www/ultra/hydrate.js",
    }[specifier] as string;
    console.log("resolover2:", specifier, String(r));
    if (specifier == "react/jsx-runtime") {
      throw Error("Cannot read properties of null: href");
    }
    return String(r);
  }
  try {
    const resolved = importMapResolve(
      specifier,
      parsedImportMap,
      new URL(referrer),
    );
    console.log("ahui91:", specifier, referrer);
    if (1 > 0 && resolved.matched) {
      console.log("ahui92:", specifier, referrer, resolved.resolvedImport.href);
      return resolved.resolvedImport.href;
    }
    return resolved.resolvedImport.href;
  } catch (err) {
    console.log("ahui93:", specifier, referrer, err);
    throw err;
  }
}

Deno.test("test e3.ts", async () => {
  const entrypoint = new SourceFile(
    entryPath,
    sroot,
  );
  const sources = new FileBag([
    entrypoint,
    new SourceFile("/Users/ahui/www/mesozoic/foo.ts", sroot),
  ]);
  const loader = createLoader({
    sources,
    target: "browser",
    dynamicImports: new FileBag(),
  });

  const graph = await createGraph(String(entrypoint!.url()), {
    kind: "codeOnly",
    defaultJsxImportSource: "react",
    resolve: importMapResolver,
    load: loader,
  });

  const module = graph.get("file:///Users/ahui/www/mesozoic/foo.ts");
  console.log({ module });
});
