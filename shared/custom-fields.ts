export const CUSTOM_KINDS = ['text', 'number', 'checkbox', 'date', 'email', 'domain', 'url', 'single_select'] as const;
export type CustomKind = typeof CUSTOM_KINDS[number];
export type CustomValue = string | number | boolean;
