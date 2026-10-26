// The picture of each project's build, baked from the real 3D scene (npm run bake:projects).
const urls = import.meta.glob('../../assets/projects/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
export const projectThumb = (id: string): string | undefined => urls[`../../assets/projects/${id}.png`];
