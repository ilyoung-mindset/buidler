import deepmerge from "deepmerge";

import { AutoNetworkConfig, BuidlerConfig, NetworkConfig } from "../types";

import * as types from "./argumentTypes";
import { BuidlerError, ERRORS } from "./errors";
import { getUserConfigPath } from "./project-structure";

function importCsjOrEsModule(path: string): any {
  const imported = require(path);
  return imported.default !== undefined ? imported.default : imported;
}

export function getConfig() {
  const pathToConfigFile = getUserConfigPath();

  // Before loading the builtin tasks, the default and user's config we expose
  // the tasks' DSL and Web3 though the global object.
  const DSL = require("./importable-tasks-dsl").default;
  const internalTask = DSL.internalTask.bind(DSL);
  const task = DSL.task.bind(DSL);

  const exported = { internalTask, task, types };
  const globalAsAny: any = global;

  Object.entries(exported).forEach(
    ([key, value]) => (globalAsAny[key] = value)
  );

  require("./tasks/builtin-tasks");

  const defaultConfig = importCsjOrEsModule("./default-config");
  const userConfig = importCsjOrEsModule(pathToConfigFile);

  // To avoid bad practices we remove the previously exported stuff
  Object.keys(exported).forEach(key => (globalAsAny[key] = undefined));

  const config = deepmerge(defaultConfig, userConfig, {
    arrayMerge: (destination: any[], source: any[]) => source
  });

  return [config, DSL.getTaskDefinitions()];
}

export function getNetworkConfig(
  config: BuidlerConfig,
  selectedNetwork: string
): NetworkConfig | AutoNetworkConfig {
  if (
    config.networks === undefined ||
    config.networks[selectedNetwork] === undefined
  ) {
    throw new BuidlerError(ERRORS.NETWORK_CONFIG_NOT_FOUND, selectedNetwork);
  }

  return config.networks[selectedNetwork];
}
