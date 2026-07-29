import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/coverage/**",
      "**/node_modules/**",
      "playwright-report/**",
      "test-results/**",
      "legacy/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["apps/web/src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-globals": [
        "error",
        ...["alert", "confirm", "prompt"].map((name) => ({
          message: "Use a shared @cge/ui dialog component.",
          name,
        })),
      ],
      "no-restricted-properties": [
        "error",
        ...["alert", "confirm", "prompt"].map((property) => ({
          message: "Use a shared @cge/ui dialog component.",
          object: "window",
          property,
        })),
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXAttribute[name.name='type'][value.value='date']",
          message: "Use DatePicker or DateRangePicker from @cge/ui.",
        },
      ],
    },
  },
);
