React testing

Create new file jest.setup.ts

import "@testing-library/jest-dom";

Install 

npm install --save-dev jest-environment-jsdom @testing-library/react @testing-library/jest-dom

Modify jest.config.ts

import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  testMatch: ["**/*.test.ts", "**/*.test.tsx"],
};

export default config;
