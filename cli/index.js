
// OVERRIDING CLI FOR TESTING PURPOSES

import fnetConfig from '@fnet/config';
import Node from "../src/index.js";

export default async ({ config = "basic-01-simple-commands" } = {}) => {
  const args = (await fnetConfig({ rel: "../tests", name: config })).data;
  const result = await Node(args);
  return result;
};
