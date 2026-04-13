import { Button } from '#/components/ui/button'
import preview from '#storybook/preview'

const meta = preview.meta({
  title: 'UI/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'outline', 'secondary', 'ghost', 'destructive', 'link'],
    },
    size: {
      control: 'select',
      options: ['default', 'xs', 'sm', 'lg', 'icon', 'icon-xs', 'icon-sm', 'icon-lg'],
    },
  },
})

export default meta

export const Default = meta.story({
  args: {
    children: 'Button',
    variant: 'default',
    size: 'default',
  },
})

export const Outline = meta.story({
  args: {
    children: 'Outline Button',
    variant: 'outline',
  },
})

export const Destructive = meta.story({
  args: {
    children: 'Destructive Button',
    variant: 'destructive',
  },
})

export const Ghost = meta.story({
  args: {
    children: 'Ghost Button',
    variant: 'ghost',
  },
})

export const Large = meta.story({
  args: {
    children: 'Large Button',
    size: 'lg',
  },
})

export const Small = meta.story({
  args: {
    children: 'Small Button',
    size: 'sm',
  },
})
