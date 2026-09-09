import type { ComponentType } from 'react'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

import { template as weeklyExportTemplate } from './weekly-export'
import { template as monthlyExportTemplate } from './monthly-export'
import { template as handoffTranscriptTemplate } from './handoff-transcript'
import { template as pipelineAlertTemplate } from './pipeline-alert'

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  'weekly-export': weeklyExportTemplate,
  'monthly-export': monthlyExportTemplate,
  'handoff-transcript': handoffTranscriptTemplate,
  'pipeline-alert': pipelineAlertTemplate,
}
