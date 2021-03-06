import path from "path";

import { BuidlerError, ERRORS } from "../../core/errors";

export interface CompilerBuild {
  path: string;
  version: string;
  build: string;
  longVersion: string;
  keccak256: string;
  urls: string[];
}

export interface CompilersList {
  builds: CompilerBuild[];
  releases: {
    [version: string]: string;
  };
  latestRelease: string;
}

const COMPILER_FILES_DIR_URL =
  "https://raw.githubusercontent.com/ethereum/solc-bin/gh-pages/bin/";

const COMPILERS_LIST_URL = COMPILER_FILES_DIR_URL + "list.json";

async function downloadFile(
  url: string,
  destinationFile: string
): Promise<void> {
  // This library indirectly validates the TLS certs, if it didn't this
  // would be MITM-able.
  const { default: download } = await import("download");
  await download(url, destinationFile);
}

export class CompilerDownloader {
  constructor(
    private readonly compilersDir: string,
    private readonly localSolcVersion: string,
    private readonly download = downloadFile
  ) {}

  public async getDownloadedCompilerPath(version: string): Promise<string> {
    const compilerBuild = await this.getCompilerBuild(version);
    const downloadedFilePath = path.join(this.compilersDir, compilerBuild.path);

    if (!(await this.fileExists(downloadedFilePath))) {
      await this.downloadCompiler(compilerBuild, downloadedFilePath);
    }

    await this.verifyCompiler(compilerBuild, downloadedFilePath);

    return downloadedFilePath;
  }

  public async getCompilerBuild(version: string): Promise<CompilerBuild> {
    const compilersListExisted = this.compilersListExists();

    let list = await this.getCompilersList();
    let compilerBuildPath = list.releases[version];

    // We may need to re-download the compilers list.
    if (compilerBuildPath === undefined && compilersListExisted) {
      const fsExtra = await import("fs-extra");
      await fsExtra.unlink(this.getCompilersListPath());

      list = await this.getCompilersList();
      compilerBuildPath = list.releases[version];
    }

    const compilerBuild = list.builds.find(b => b.path === compilerBuildPath);

    if (compilerBuild === undefined) {
      throw new BuidlerError(ERRORS.COMPILER_INVALID_VERSION, version);
    }

    return compilerBuild;
  }

  public async getCompilersList(): Promise<CompilersList> {
    if (!(await this.compilersListExists())) {
      await this.downloadCompilersList();
    }

    const fsExtra = await import("fs-extra");
    return fsExtra.readJson(this.getCompilersListPath());
  }

  public getCompilersListPath() {
    return path.join(this.compilersDir, "list.json");
  }

  public async compilersListExists() {
    const fsExtra = await import("fs-extra");
    return fsExtra.pathExists(this.getCompilersListPath());
  }

  public async downloadCompilersList() {
    try {
      await this.download(COMPILERS_LIST_URL, this.compilersDir);
    } catch (error) {
      throw new BuidlerError(
        ERRORS.COMPILER_VERSION_LIST_DOWNLOAD_FAILED,
        error,
        this.localSolcVersion
      );
    }
  }

  public async downloadCompiler(
    compilerBuild: CompilerBuild,
    downloadedFilePath: string
  ) {
    console.debug("Downloading compiler version " + compilerBuild.version);

    const compilerUrl = COMPILER_FILES_DIR_URL + compilerBuild.path;

    try {
      await this.download(compilerUrl, downloadedFilePath);
    } catch (error) {
      throw new BuidlerError(
        ERRORS.COMPILER_DOWNLOAD_FAILED,
        error,
        compilerBuild.version,
        this.localSolcVersion
      );
    }
  }

  public async verifyCompiler(
    compilerBuild: CompilerBuild,
    downloadedFilePath: string
  ) {
    const fsExtra = await import("fs-extra");
    const ethereumjsUtil = await import("ethereumjs-util");

    const expectedKeccak256 = compilerBuild.keccak256;
    const compiler = await fsExtra.readFile(downloadedFilePath);

    const compilerKeccak256 =
      "0x" + ethereumjsUtil.keccak(compiler).toString("hex");

    if (expectedKeccak256 !== compilerKeccak256) {
      await fsExtra.unlink(downloadedFilePath);

      throw new BuidlerError(
        ERRORS.COMPILER_INVALID_DOWNLOAD,
        compilerBuild.version,
        this.localSolcVersion
      );
    }
  }

  private async fileExists(filePath: string) {
    const fsExtra = await import("fs-extra");
    return fsExtra.pathExists(filePath);
  }
}
