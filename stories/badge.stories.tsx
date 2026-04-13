import { Badge } from '#/components/ui/badge'
import preview from '#storybook/preview'

const meta = preview.meta({
  title: 'UI/Badge',
  component: Badge,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'secondary', 'destructive', 'outline', 'ghost', 'link'],
    },
  },
})

export default meta

export const Default = meta.story({
  args: {
    children: 'Badge',
    variant: 'default',
  },
})

export const Secondary = meta.story({
  args: {
    children: 'Secondary',
    variant: 'secondary',
  },
})

export const Destructive = meta.story({
  args: {
    children: 'Destructive',
    variant: 'destructive',
  },
})

export const Outline = meta.story({
  args: {
    children: 'Outline',
    variant: 'outline',
  },
})
