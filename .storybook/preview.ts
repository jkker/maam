import addonA11y from '@storybook/addon-a11y'
import addonDocs from '@storybook/addon-docs'
import addonThemes, { withThemeByClassName } from '@storybook/addon-themes'
import { definePreview } from '@storybook/react-vite'
import { initialize, mswLoader, type MswParameters } from 'msw-storybook-addon'

import '../src/index.css'

declare module 'storybook/internal/csf' {
  interface Parameters {
    /**
     * Determines how the component is displayed within the Storybook Canvas.
     *
     *   - `'centered'`: Centers the component both horizontally and vertically in the Canvas.
     *   - `'fullscreen'`: Allows the component to expand to the full width and height of the Canvas.
     *   - `'padded'` (default): Adds extra padding around the component.
     *
     * @see https://storybook.js.org/docs/configure/story-layout
     */
    layout?: 'centered' | 'fullscreen' | 'padded'
    /**
     *
     * You can pass request [handlers](https://mswjs.io/docs/concepts/request-handler) into the handlers property of the msw parameter. This is commonly an array of handlers.
     *
     * The handlers property can also be an object where the keys are either arrays of handlers or a handler itself. This enables you to inherit (and optionally overwrite/disable) handlers from preview.js using parameter inheritance
     *
     * @see {@link https://storybook.js.org/addons/msw-storybook-addon} for more details and examples.
     */
    msw?: MswParameters['msw']
  }
}

initialize()

const preview = definePreview({
  addons: [addonA11y(), addonDocs(), addonThemes()],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    docs: {
      codePanel: true,
      toc: {
        headingSelector: 'h2, h3, h4',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    withThemeByClassName({
      themes: {
        light: '',
        dark: 'dark',
      },
      defaultTheme: 'light',
    }),
  ],
  loaders: [mswLoader],
})

export default preview
