import tseslint from 'typescript-eslint'
import boundaries from 'eslint-plugin-boundaries'
import jsxA11y from 'eslint-plugin-jsx-a11y'

// Scoped deliberately to architecture-boundary enforcement plus jsx-a11y's
// recommended rule set -- not a general strict-lint adoption. The TS parser
// is wired up only so eslint-plugin-boundaries can parse .tsx import syntax;
// no typescript-eslint rule set is enabled here.
export default tseslint.config(
  { ignores: ['dist/**'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { boundaries, 'jsx-a11y': jsxA11y },
    settings: {
      'import/resolver': {
        typescript: { project: './tsconfig.json' },
      },
      'boundaries/elements': [
        { type: 'feature', pattern: 'src/features/*', capture: ['featureName'] },
        // Deliberately narrow: components/ui/** is the proven-reusable-
        // primitives boundary (Button, Card, Dialog, ...) that must stay
        // generic. components/layout/** (Shell.tsx), App.tsx, and main.tsx
        // are left unclassified on purpose -- they're the app shell /
        // composition root, not generic primitives, and legitimately
        // compose features (e.g. Shell.tsx calls features/presence's
        // useAppPresenceReporting()). Only classified elements are subject
        // to the policies below.
        { type: 'shared-ui', pattern: 'src/components/ui/**' },
        { type: 'shared-lib', pattern: 'src/lib/**' },
      ],
    },
    rules: {
      // - components/ui/ (shared UI primitives) can never import from
      //   features/ -- it must stay generic.
      // - a feature may freely import its own internal files (same-instance
      //   dependencies are ignored by this plugin by default), but
      //   importing a *different* feature must go through that feature's
      //   index.ts, never its internals directly.
      'boundaries/dependencies': [
        'error',
        {
          default: 'allow',
          policies: [
            {
              from: { element: { type: 'shared-ui' } },
              disallow: { to: { element: { type: 'feature' } } },
              message: 'components/ui/ (shared UI primitives) must not import from features/ -- keep shared UI limited to generic, proven-reusable primitives.',
            },
            {
              from: { element: { type: 'feature' } },
              to: { element: { type: 'feature' } },
              allow: { to: { element: { fileInternalPath: 'index.ts' } } },
              disallow: { to: { element: { fileInternalPath: '!index.ts' } } },
              message: 'Cross-feature imports must go through the target feature\'s index.ts (its public boundary), not its internal files.',
            },
          ],
        },
      ],
      // jsx-a11y's recommended set (34 rules, e.g. label-has-associated-
      // control, aria-role, no-noninteractive-element-interactions) -- this
      // is what should have caught the Field/aria-pressed/aria-checked gaps
      // this pass fixed by hand; wiring it in means the next one is caught
      // at lint time instead of during a manual review.
      ...jsxA11y.flatConfigs.recommended.rules,
    },
  },
)
