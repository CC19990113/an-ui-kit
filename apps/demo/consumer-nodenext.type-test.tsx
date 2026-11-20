import type {} from '@an-ui-kit/elements/react';
import type {} from '@an-ui-kit/elements/vue';
import type { AnSelect, AnSelectChangeDetail } from '@an-ui-kit/elements';
import { createRef } from 'react';
import type { GlobalComponents } from 'vue';

type Assert<T extends true> = T;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type VueSelectProps = InstanceType<GlobalComponents['AnSelect']>['$props'];

export type ConsumerChecks = [
  Assert<Equal<HTMLElementTagNameMap['an-select'], AnSelect>>,
  Assert<Equal<NonNullable<VueSelectProps['onAnSelectChange']>, (event: CustomEvent<AnSelectChangeDetail>) => void>>,
  Assert<Equal<NonNullable<React.JSX.IntrinsicElements['an-select']['onan-select-change']>, (event: CustomEvent<AnSelectChangeDetail>) => void>>,
];

export const select = (
  <an-select ref={createRef<AnSelect>()} onan-select-change={(event) => event.detail.values.join(',')} />
);
