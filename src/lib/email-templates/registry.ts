import type { ComponentType } from 'react'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

import { template as orderAccepted } from './order-accepted'
import { template as orderInTransit } from './order-in-transit'
import { template as orderDelivered } from './order-delivered'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'order-accepted': orderAccepted,
  'order-in-transit': orderInTransit,
  'order-delivered': orderDelivered,
}
