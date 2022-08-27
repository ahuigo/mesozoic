import {
  globToRegExp,
  join,
  log,
  resolve,
  sprintf,
  toFileUrl,
  walk,
} from "./deps.ts";
import { IFile } from "./file.ts";
import { FileBag } from "./fileBag.ts";
import { buildModuleGraph } from "./graph.ts";
import {
  ParsedImportMap,
  parseImportMap,
  resolveSpecifierFromImportMap,
} from "./importMap.ts";
import { Logger } from "./logger.ts";
import { SourceFile } from "./sourceFile.ts";
import { EntrypointFile } from "./entrypointFile.ts";
import type { ImportMap } from "./types.ts";
import { isRemoteSpecifier } from "./utils.ts";
import { vendorRemoteModules } from "./vendor.ts";

export type BuildContext = {
  root: string;
  output: string;
  importMap: string;
  compiler?: {
    minify?: boolean;
    sourceMaps?: boolean;
  };
  name?: string;
  logLevel?: log.LevelName;
};

export type BuilderEntrypointTarget = "browser" | "deno";
/**
 * An object where the keys are a path of an entrypoint
 * relative to the {@link BuildContext.root}
 */
export type BuilderEntrypoints = {
  [path: string]: BuilderEntrypoint;
};

export type BuilderEntrypoint = {
  /**
   * The output directory for the vendored dependencies
   * of this entrypoint, relative to the vendor output directory.
   */
  output: string;
  target: BuilderEntrypointTarget;
};

export type BuildResult = {
  sources: FileBag;
  compiled: FileBag;
  entrypoints: EntrypointFile[];
  vendored: FileBag;
};

export class Builder {
  private hasCopied = false;
  private isValid = false;
  private importMap: ParsedImportMap = {
    imports: {},
    scopes: {},
  };

  public log: Logger;
  public entrypoints: Map<string, BuilderEntrypoint> = new Map();

  public excluded: RegExp[] = [];
  public hashed: RegExp[] = [];
  public compiled: RegExp[] = [];

  constructor(public readonly context: BuildContext) {
    this.log = new Logger(context?.logLevel || "INFO", context?.name);

    if (this.context.root.startsWith(".")) {
      throw new Error("root must be an absolute path");
    }
    if (this.context.output.startsWith(".")) {
      throw new Error("output must be an absolute path");
    }

    const importMap: ImportMap = JSON.parse(
      Deno.readTextFileSync(
        join(this.context.root, this.context.importMap),
      ),
    );

    this.importMap = this.#parseImportMap(importMap);
  }

  setEntrypoints(entrypoints: BuilderEntrypoints) {
    this.entrypoints = new Map(Object.entries(entrypoints));
  }

  getEntrypoint(path: string) {
    return this.entrypoints.get(path);
  }

  isEntrypoint(source: IFile): boolean {
    const alias = source.relativeAlias();
    const path = alias ?? source.relativePath();

    return this.entrypoints.has(path);
  }

  setCompiled(paths: string[]) {
    this.compiled = this.#buildPatterns(paths);
  }

  isCompilable(source: IFile): boolean {
    return this.compiled.some((pattern) => pattern.test(source.relativePath()));
  }

  setHashed(paths: string[]) {
    this.hashed = this.#buildPatterns(paths);
  }

  isHashable(source: IFile): boolean {
    return this.hashed.some((pattern) => pattern.test(source.relativePath()));
  }

  setExcluded(paths: string[]) {
    this.excluded = this.#buildPatterns([
      ...paths,
      this.context.output,
    ]);
  }

  isExcluded(source: IFile): boolean {
    return this.excluded.some((pattern) => pattern.test(source.relativePath()));
  }

  async build(sources: FileBag): Promise<BuildResult> {
    this.#valid();

    /**
     * Gather compilable sources and compile them
     */
    try {
      const compilable = sources.filter((source) => this.isCompilable(source));
      const compiled = await this.compileSources(compilable);

      /**
       * Get the entrypoint source files
       */
      const entrypoints = Array.from(
        sources.filter((source) => this.isEntrypoint(source)),
      ).map((source) => new EntrypointFile(source.path(), source.root()));

      /**
       * Get all the local sources
       */
      const localSources = sources.filter((source) =>
        !isRemoteSpecifier(source.url())
      );

      /**
       * Create the module graph for each entrypoint
       */
      let vendoredSources = new FileBag();

      for (const entrypoint of entrypoints.values()) {
        const path = entrypoint.relativeAlias() ?? entrypoint.relativePath();
        this.log.info(sprintf("Building module graph fo entrypoint %s", path));

        const graph = await buildModuleGraph(
          this,
          localSources,
          entrypoint,
        );

        entrypoint.setModuleGraph(graph);

        this.log.success("Module graph built");

        /**
         * Vendor remote modules for each entrypoint
         */
        // this.log.info(sprintf("Vendor remote modules for entrypoint %s", path));

        // const { vendored, outputDir } = await vendorRemoteModules(
        //   this,
        //   graph,
        //   entrypoint,
        //   localSources,
        // );

        // const copied = await this.copySources(vendored, outputDir);
        // vendoredSources = vendoredSources.merge(copied);

        // this.log.success(
        //   sprintf("Vendored modules for entrypoint %s", path),
        // );
      }

      return {
        sources,
        compiled,
        entrypoints,
        vendored: vendoredSources,
      };
    } catch (error) {
      throw error;
    }
  }

  #valid() {
    if (this.isValid) {
      return;
    }

    if (!this.hasCopied) {
      throw new Error("must copy sources before performing a build.");
    }

    this.isValid = true;
  }

  /**
   * Walk the root for SourceFiles obeying exclusion patterns
   */
  async gatherSources(from: string = this.context.root) {
    const sources = new FileBag();

    for await (const entry of walk(from)) {
      if (entry.isFile) {
        const sourceFile = new SourceFile(entry.path, from);
        sources.add(sourceFile);
      }
    }

    return sources;
  }

  async cleanOutput() {
    try {
      await Deno.remove(this.context.output, { recursive: true });
    } catch (_error) {
      // whatever
    }
  }

  async copySources(
    sources: FileBag,
    destination: string = this.context.output,
  ) {
    const result: FileBag = new FileBag();

    for (const source of sources.values()) {
      try {
        const copied = await this.copySource(source, destination);
        if (copied) {
          result.add(copied);
        }
      } catch (error) {
        throw error;
      }
    }

    this.hasCopied = true;

    return result;
  }

  async copySource(source: IFile, destination: string) {
    if (!this.isExcluded(source)) {
      let copied: IFile;
      if (this.isHashable(source)) {
        copied = await source.copyToHashed(destination);
      } else {
        copied = await source.copyTo(destination);
      }

      return copied;
    }
  }

  async compileSources(sources: FileBag) {
    this.#valid();

    for (const source of sources.values()) {
      await this.compileSource(source);
    }

    return sources;
  }

  async compileSource(source: IFile): Promise<IFile> {
    const { compile } = await import("./compiler.ts");

    if (!this.isCompilable(source)) {
      throw new Error(
        sprintf(
          "source is not compilable: %s",
          source.relativePath(),
        ),
      );
    }

    const content = await source.read();
    const compiled = await compile(content, {
      filename: source.path(),
      development: false,
      minify: this.context?.compiler?.minify,
      sourceMaps: this.context?.compiler?.sourceMaps,
    });

    await source.write(compiled.code);

    return source;
  }

  processSources(
    sources: FileBag,
    processor: (source: IFile) => Promise<IFile> | IFile,
  ) {
    this.#valid();
    return Promise.all(sources.toArray().map((source) => processor(source)));
  }

  toManifest(
    sources: FileBag,
    { exclude = [], prefix }: { exclude?: string[]; prefix?: string },
  ) {
    const json = [];

    const excluded = this.#buildPatterns(exclude);

    for (const source of sources.values()) {
      const isExcluded = excluded.some((pattern) =>
        pattern.test(source.relativePath())
      );
      if (!isExcluded) {
        json.push([
          source.relativeAlias() ?? source.relativePath(),
          prefix ? resolve(prefix, source.relativePath()) : source.path(),
        ]);
      }
    }

    return json;
  }

  resolveImportSpecifier(
    specifier: string,
    referrer: URL = new URL(import.meta.url),
  ) {
    return resolveSpecifierFromImportMap(specifier, this.importMap, referrer);
  }

  #parseImportMap(importMap: ImportMap) {
    return parseImportMap(
      importMap,
      toFileUrl(this.context.output),
    );
  }

  #buildPatterns(patterns?: string[]) {
    if (!patterns) {
      return [];
    }

    return patterns.map((pattern) => {
      return globToRegExp(pattern, {
        extended: true,
        globstar: true,
        caseInsensitive: false,
      });
    });
  }
}
