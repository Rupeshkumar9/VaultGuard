/**
 * Keep popup sizing isolated from the shared mobile markup.
 */
export function getVaultViewportStyle({ isExtension, isNative, isAutofillMode }) {
  if (isAutofillMode) return { width: '100%', height: '100%' };
  if (isExtension) return { width: '380px', height: '600px' };
  if (isNative) return { width: '100%', height: '100dvh' };
  return undefined;
}
