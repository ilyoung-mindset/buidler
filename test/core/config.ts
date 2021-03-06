import { assert, expect } from "chai";

import { getConfig, getNetworkConfig } from "../../src/core/config";
import { BuidlerError, ErrorDescription, ERRORS } from "../../src/core/errors";
import { getLocalCompilerVersion } from "../helpers/compiler";
import { useFixtureProject } from "../helpers/project";

function assertCorrectError(f: () => any, error: ErrorDescription) {
  expect(f)
    .to.throw(BuidlerError)
    .with.property("number", error.number);
}

describe("config", () => {
  describe("custom config", () => {
    useFixtureProject("config-project");

    it("should fail on getting non existent network config", () => {
      const [config, _] = getConfig();
      assertCorrectError(() => {
        getNetworkConfig(config, "local");
      }, ERRORS.NETWORK_CONFIG_NOT_FOUND);
    });

    it("should return the selected network config", () => {
      const [config, _] = getConfig();
      assert.equal(
        getNetworkConfig(config, "develop"),
        config.networks.develop
      );
    });

    it("should return the config merged ", () => {
      const [config, tasks] = getConfig();

      assert.equal(config.solc.version, getLocalCompilerVersion());
      assert.containsAllKeys(config.networks, ["auto", "develop", "custom"]);
      assert.containsAllKeys(tasks, [
        "clean",
        "flatten",
        "compile",
        "help",
        "run",
        "test"
      ]);
    });

    it("should return the config merged ", () => {
      const [config, tasks] = getConfig();
      assert.equal(config.solc.version, getLocalCompilerVersion());
      assert.containsAllKeys(config.networks, ["auto", "develop", "custom"]);
      assert.equal(config.networks.develop.port, 1337);
    });
  });

  describe("default config", () => {
    useFixtureProject("default-config-project");

    it("should return the default config", () => {
      const [config, tasks] = getConfig();
      assert.equal(config.solc.version, getLocalCompilerVersion());
      assert.containsAllKeys(config.networks, ["auto", "develop"]);
      assert.containsAllKeys(tasks, [
        "clean",
        "flatten",
        "compile",
        "help",
        "run",
        "test"
      ]);
    });

    it("should remove things from global state", () => {
      const globalAsAny: any = global;
      assert.isUndefined(globalAsAny.internalTask);
      assert.isUndefined(globalAsAny.task);
    });

    it("should return config with overridden tasks", () => {});
  });
});
