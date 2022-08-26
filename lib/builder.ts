import {
  AbstractBuilder,
  BuildContext,
  BuildResult,
} from "./abstractBuilder.ts";
import { crayon, log, sprintf } from "./deps.ts";
import { Logger } from "./logger.ts";
import { ISource } from "./source.ts";
import { SourceFileBag } from "./sourceFileBag.ts";

/**
 * A Builder with logging
 */
export class Builder extends AbstractBuilder {
  public logger: Logger;

  constructor(context: BuildContext & { logLevel?: log.LevelName }) {
    super(context);
    this.logger = new Logger(context.logLevel || "NOTSET");
  }

  async build(sources: SourceFileBag): Promise<BuildResult> {
    this.logger.info("Building");
    try {
      const result = await super.build(sources);
      this.logger.info("Build complete");

      return result;
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
  }

  async gatherSources(
    from: string = this.context.root,
  ): Promise<SourceFileBag> {
    try {
      this.logger.info(sprintf("Gathering sources from: %s", from));
      const sources = await super.gatherSources(from);
      this.logger.info("Gathered sources");

      return sources;
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
  }
  async cleanOutput() {
    try {
      this.logger.info(sprintf("Cleaning %s", this.context.output));
      await super.cleanOutput();
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
  }

  async vendorSources(sources: SourceFileBag) {
    try {
      this.logger.info(sprintf("Vendoring %d sources", sources.size));
      const vendored = await super.vendorSources(sources);
      this.logger.info(sprintf("Vendored %d dependencies", vendored.size));

      return vendored;
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
  }

  async copySources(
    sources: SourceFileBag,
    destination: string = this.context.output,
  ) {
    try {
      this.logger.info(sprintf("Copy %d sources", sources.size));
      const copied = await super.copySources(sources, destination);
      this.logger.info(sprintf("Copied %d sources", copied.size));

      return copied;
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
  }

  copySource(source: ISource, destination: string) {
    try {
      this.logger.info(
        sprintf("Copy %s -> %s", source.path(), destination),
      );
      return super.copySource(source, destination);
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
  }

  async compileSources(sources: SourceFileBag) {
    try {
      this.logger.info(sprintf("Compiling %d sources", sources.size));
      const compiled = await super.compileSources(sources);
      this.logger.info(sprintf("Compiled %d sources", compiled.size));

      return compiled;
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
  }

  async compileSource(source: ISource) {
    try {
      this.logger.info(sprintf("Compiling source: %s", source.path()));
      await super.compileSource(source);
      this.logger.info(sprintf("Compiled source: %s", source.path()));
      return source;
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
  }

  async buildModuleGraph(sources: SourceFileBag) {
    try {
      this.logger.info(
        sprintf("Building module graph for %d sources", sources.size),
      );
      const graph = await super.buildModuleGraph(sources);
      this.logger.info(sprintf("Built module graph"));

      return graph;
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
  }

  isEntrypoint(source: ISource, aliased = true): boolean {
    try {
      const value = super.isEntrypoint(source, aliased);
      this.logger.info(
        sprintf(
          "isEntrypoint: %s = %s",
          source.relativePath(),
          this.#formatBoolean(value),
        ),
      );
      return value;
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
  }

  isIgnored(source: ISource): boolean {
    try {
      const value = super.isIgnored(source);
      this.logger.info(
        sprintf(
          "isIgnored: %s = %s",
          source.relativePath(),
          this.#formatBoolean(value),
        ),
      );
      return value;
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
  }

  isCompilable(source: ISource): boolean {
    try {
      const value = super.isCompilable(source);
      this.logger.info(
        sprintf(
          "isCompilable: %s = %s",
          source.relativePath(),
          this.#formatBoolean(value),
        ),
      );
      return value;
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
  }

  isHashable(source: ISource): boolean {
    try {
      const value = super.isHashable(source);
      this.logger.info(
        sprintf(
          "isHashable: %s = %s",
          source.relativePath(),
          this.#formatBoolean(value),
        ),
      );
      return value;
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
  }

  isManifestExcluded(source: ISource): boolean {
    try {
      const value = super.isManifestExcluded(source);
      this.logger.info(
        sprintf(
          "isManifestExcluded: %s = %s",
          source.relativePath(),
          this.#formatBoolean(value),
        ),
      );
      return value;
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
  }

  #formatBoolean(value: boolean) {
    return value ? crayon.green("true") : crayon.red("false");
  }
}
