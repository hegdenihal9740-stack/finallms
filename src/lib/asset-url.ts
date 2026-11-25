// Local Vite has no Lovable asset proxy; use the project's asset-serving origin there.
export function assetUrl(path: string, local = import.meta.env.DEV) {
  return local && path.startsWith('/__l5e/assets-v1/')
    ? `https://id-preview--2ff14cf2-bdbf-46b7-88dd-71c6944501d0.lovable.app${path}`
    : path;
}