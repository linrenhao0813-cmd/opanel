import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import { globalIgnores } from "eslint/config";
import react from "eslint-plugin-react";
import stylistic from "@stylistic/eslint-plugin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  globalIgnores([
    "scripts/**",
    "build/**",
    "components/ui/**",
  ]),
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    plugins: {
      react,
      "@stylistic": stylistic,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@next/next/no-img-element": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "@typescript-eslint/no-unused-vars": ["error", {
        "args": "none",
        "caughtErrors": "none"
      }],
      "@typescript-eslint/consistent-type-imports": "warn",
      "import/order": ["warn", {
        groups: [
          "type",
          "builtin",
          "external",
        ],
        "newlines-between": "ignore"
      }],
      "import/first": "error",
      "import/no-duplicates": "error",
      "import/no-named-as-default": "off",
      "keyword-spacing": ["error", {
        "after": true,
        "overrides": {
          "if": { "after": false },
          "for": { "after": false },
          "while": { "after": false },
          "switch": { "after": false },
          "with": { "after": false },
        }
      }],
      "brace-style": ["error", "1tbs", { "allowSingleLine": true }],
      "no-unneeded-braces": "off",
      "arrow-body-style": ["error", "as-needed"],
      "react/jsx-closing-bracket-location": ["error", "after-props"],
      "react/jsx-closing-tag-location": ["error", "tag-aligned"],
      "@stylistic/implicit-arrow-linebreak": ["error", "beside"],
      "@stylistic/nonblock-statement-body-position": ["error", "beside"],
    }
  }
];

export default eslintConfig;
