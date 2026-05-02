import type { FieldProps } from './types'
import TextField from './TextField'
import TextareaField from './TextareaField'
import RadioField from './RadioField'
import CheckboxField from './CheckboxField'
import SelectField from './SelectField'
import NumberField from './NumberField'
import DateField from './DateField'
import TimeField from './TimeField'
import PasswordField from './PasswordField'
import SeparatorField from './SeparatorField'
import DisplayField from './DisplayField'
import ImageField from './ImageField'
import FileField from './FileField'
import SignatureField from './SignatureField'

export type { FieldProps }

export function FieldRenderer(props: FieldProps) {
  switch (props.question.type) {
    case 'display': return <DisplayField {...props} />
    case 'image': return <ImageField {...props} />
    case 'separator': return <SeparatorField {...props} />
    case 'file': return <FileField {...props} />
    case 'signature': return <SignatureField {...props} />
    case 'textarea': return <TextareaField {...props} />
    case 'radio': return <RadioField {...props} />
    case 'checkbox': return <CheckboxField {...props} />
    case 'select': return <SelectField {...props} />
    case 'number': return <NumberField {...props} />
    case 'date': return <DateField {...props} />
    case 'time': return <TimeField {...props} />
    case 'password': return <PasswordField {...props} />
    case 'button': return null
    default: return <TextField {...props} />
  }
}
