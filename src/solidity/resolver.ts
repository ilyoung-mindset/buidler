import path from "path";

import { BuidlerError, ERRORS } from "../core/errors";

export interface LibraryInfo {
  name: string;
  version: string;
}

export class ResolvedFile {
  public readonly library?: LibraryInfo;

  constructor(
    public readonly globalName: string,
    public readonly absolutePath: string,
    public readonly content: string,
    public readonly lastModificationDate: Date,
    libraryName?: string,
    libraryVersion?: string
  ) {
    this.globalName = globalName;
    this.absolutePath = absolutePath;
    this.content = content;
    this.lastModificationDate = lastModificationDate;

    if (libraryName !== undefined && libraryVersion !== undefined) {
      this.library = {
        name: libraryName,
        version: libraryVersion
      };
    }
  }

  public getVersionedName() {
    return (
      this.globalName +
      (this.library !== undefined ? `@v${this.library.version}` : "")
    );
  }
}

export class Resolver {
  constructor(private readonly projectRoot: string) {}

  public async resolveProjectSourceFile(
    pathToResolve: string
  ): Promise<ResolvedFile> {
    const fsExtra = await import("fs-extra");

    if (!(await fsExtra.pathExists(pathToResolve))) {
      throw new BuidlerError(ERRORS.RESOLVER_FILE_NOT_FOUND, pathToResolve);
    }

    const absolutePath = await fsExtra.realpath(pathToResolve);

    if (!absolutePath.startsWith(this.projectRoot)) {
      throw new BuidlerError(
        ERRORS.RESOLVER_FILE_OUTSIDE_PROJECT,
        pathToResolve
      );
    }

    if (absolutePath.includes("node_modules")) {
      throw new BuidlerError(
        ERRORS.RESOLVER_LIBRARY_FILE_NOT_LOCAL,
        pathToResolve
      );
    }

    const globalName = absolutePath.slice(this.projectRoot.length + 1);

    return this._resolveFile(globalName, absolutePath);
  }

  public async resolveLibrarySourceFile(
    globalName: string
  ): Promise<ResolvedFile> {
    const fsExtra = await import("fs-extra");
    const libraryName = globalName.slice(0, globalName.indexOf("/"));

    let packagePath;
    try {
      packagePath = this._resolveFromProjectRoot(
        path.join(libraryName, "package.json")
      );
    } catch (error) {
      throw new BuidlerError(
        ERRORS.RESOLVER_LIBRARY_NOT_INSTALLED,
        error,
        libraryName
      );
    }

    let absolutePath;
    try {
      absolutePath = this._resolveFromProjectRoot(globalName);
    } catch (error) {
      throw new BuidlerError(
        ERRORS.RESOLVER_LIBRARY_FILE_NOT_FOUND,
        error,
        globalName
      );
    }

    const libraryPath = path.dirname(packagePath);
    if (!absolutePath.startsWith(libraryPath)) {
      // If it's still from a library with the same name what is happening is
      // that the package.json and the file are being resolved to different
      // installations of the library. This can lead to very confusing
      // situations, so we only use the closes installation
      if (absolutePath.includes(`node_modules/${libraryName}`)) {
        throw new BuidlerError(
          ERRORS.RESOLVER_LIBRARY_FILE_NOT_FOUND,
          globalName
        );
      }

      throw new BuidlerError(ERRORS.RESOLVER_FILE_OUTSIDE_LIB, globalName);
    }

    const packageInfo = await fsExtra.readJson(packagePath);
    const libraryVersion = packageInfo.version;

    return this._resolveFile(
      globalName,
      absolutePath,
      libraryName,
      libraryVersion
    );
  }

  public async resolveImport(
    from: ResolvedFile,
    imported: string
  ): Promise<ResolvedFile> {
    try {
      if (this._isRelativeImport(imported)) {
        if (from.library === undefined) {
          return await this.resolveProjectSourceFile(
            path.normalize(path.join(path.dirname(from.absolutePath), imported))
          );
        }

        const globalName = path.normalize(
          path.dirname(from.globalName) + "/" + imported
        );

        const isIllegal = !globalName.startsWith(from.library.name + path.sep);

        if (isIllegal) {
          throw new BuidlerError(
            ERRORS.RESOLVER_ILLEGAL_IMPORT,
            imported,
            from.globalName
          );
        }

        imported = globalName;
      }

      return await this.resolveLibrarySourceFile(imported);
    } catch (error) {
      if (
        error.number === ERRORS.RESOLVER_FILE_NOT_FOUND.number ||
        error.number === ERRORS.RESOLVER_LIBRARY_FILE_NOT_FOUND.number
      ) {
        throw new BuidlerError(
          ERRORS.RESOLVED_IMPORTED_FILE_NOT_FOUND,
          error,
          imported,
          from.globalName
        );
      }

      throw error;
    }
  }

  public async _resolveFile(
    globalName: string,
    absolutePath: string,
    libraryName?: string,
    libraryVersion?: string
  ): Promise<ResolvedFile> {
    const fsExtra = await import("fs-extra");
    const content = await fsExtra.readFile(absolutePath, { encoding: "utf8" });
    const stats = await fsExtra.stat(absolutePath);
    const lastModificationDate = new Date(stats.mtime);

    return new ResolvedFile(
      globalName,
      absolutePath,
      content,
      lastModificationDate,
      libraryName,
      libraryVersion
    );
  }

  public _isRelativeImport(imported: string): boolean {
    return imported.startsWith("./") || imported.startsWith("../");
  }

  public _resolveFromProjectRoot(fileName: string) {
    return require.resolve(fileName, {
      paths: [this.projectRoot]
    });
  }
}
