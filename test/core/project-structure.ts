import { assert } from "chai";
import * as fsExtra from "fs-extra";

import { ERRORS } from "../../src/core/errors";
import {
  getProjectRoot,
  getRecommendedGitIgnore,
  getUserConfigPath,
  isCwdInsideProject
} from "../../src/core/project-structure";
import { expectBuidlerError } from "../helpers/errors";
import { useFixtureProject } from "../helpers/project";

function testProjectPathsGetter(
  name: string,
  getter: () => string,
  relativePathFromFixture: string
) {
  describe(name, () => {
    it("should throw if cwd is not inside a project", () => {
      expectBuidlerError(() => getter(), ERRORS.BUIDLER_NOT_INSIDE_PROJECT);
    });

    describe("Inside a project", () => {
      useFixtureProject("default-config-project");
      let path: string;

      before("get root path", async () => {
        // TODO: This is no longer needed once PR #71 gets merged
        const pathToFixtureRoot = await fsExtra.realpath(
          __dirname + "/../fixture-projects/default-config-project"
        );

        path = await fsExtra.realpath(
          pathToFixtureRoot + "/" + relativePathFromFixture
        );
      });

      it("should work from the project root", () => {
        assert.equal(getter(), path);
      });

      it("should work from deeper inside the project", () => {
        process.chdir("contracts");
        assert.equal(getter(), path);
      });
    });
  });
}

describe("project structure", () => {
  describe("isCwdInsideProject", () => {
    it("should return false if cwd is not inside a project", () => {
      assert.isFalse(isCwdInsideProject());
    });

    describe("Inside a project", () => {
      useFixtureProject("default-config-project");

      it("should return true if cwd is the project's", () => {
        assert.isTrue(isCwdInsideProject());
      });

      it("should return true if cwd is deeper inside the project", () => {
        process.chdir("contracts");
        assert.isTrue(isCwdInsideProject());
      });
    });
  });

  testProjectPathsGetter(
    "getUserConfigPath",
    getUserConfigPath,
    "./buidler-config.js"
  );

  testProjectPathsGetter("getProjectRoot", getProjectRoot, ".");
});

describe("getRecommendedGitIgnore", () => {
  it("Should return the one from this repo", async () => {
    const content = await fsExtra.readFile(
      __dirname + "/../../recommended-gitignore.txt",
      "utf-8"
    );

    assert.equal(await getRecommendedGitIgnore(), content);
  });
});
