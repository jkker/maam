import { createFormHook } from '@tanstack/react-form'

import {
  SelectField,
  SliderField,
  SubmitButton,
  SwitchField,
  TextAreaField,
  TextField,
} from '#/components/form-fields'
import { fieldContext, formContext } from '#/hooks/form-context'

export { useFieldContext, useFormContext } from '#/hooks/form-context'

export const { useAppForm } = createFormHook({
  fieldComponents: {
    TextField,
    TextAreaField,
    SelectField,
    SliderField,
    SwitchField,
  },
  formComponents: {
    SubmitButton,
  },
  fieldContext,
  formContext,
})
