/**
 * Assemble the package's real framework declarations in the demo program.
 * Keep consumer assertions in react.tsx: skipLibCheck must not hide them.
 * No local JSX/GlobalComponents shim lives here.
 */
import type {} from '@an-ui-kit/elements/react';
import type {} from '@an-ui-kit/elements/vue';

import type { GlobalComponents } from 'vue';

/** Compatibility aliases retained for code which imported the old demo types. */
export type AnButtonVueComponent = GlobalComponents['AnButton'];
export type AnInputVueComponent = GlobalComponents['AnInput'];
