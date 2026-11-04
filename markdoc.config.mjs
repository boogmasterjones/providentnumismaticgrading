// Photos in page and journal text are served like every other photo: sized at build time (src/components/Photo.astro).
import { component, defineMarkdocConfig, nodes } from '@astrojs/markdoc/config';

export default defineMarkdocConfig({
  nodes: {
    image: {
      ...nodes.image,
      render: component('./src/components/Photo.astro'),
      attributes: { ...nodes.image.attributes, sizes: { type: String, default: '(max-width: 720px) 100vw, 640px' } },
    },
  },
});
