module.exports = {
  env: {
    browser: false,
    es2021: true,
    node: true,
  },
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  overrides: [],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "./tsconfig.json",
    tsConfigRootDir: __dirname,
    ecmaVersion: "latest",
    sourceType: "module",
  },
  plugins: ["@typescript-eslint", "eslint-plugin-tsdoc"],
  rules: {
    "@typescript-eslint/no-empty-function": ["off"],
    "tsdoc/syntax": "error",
  },
};
