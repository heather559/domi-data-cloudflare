import * as React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

export interface PipelineAlertItem {
  agentName?: string
  weekStart?: string
  kind?: 'failed' | 'stalled'
  status?: string
  startedAt?: string
  minutesRunning?: number
  detail?: string | null
}

export interface PipelineAlertProps {
  items?: PipelineAlertItem[]
  stallMinutes?: number
  dashboardUrl?: string
  checkedAt?: string
}

const main = {
  backgroundColor: '#ffffff',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  color: '#0a0a0a',
}
const container = { margin: '0 auto', padding: '32px 24px', maxWidth: '600px' }
const h1 = { fontSize: '20px', fontWeight: 500, margin: '0 0 4px' }
const meta = { fontSize: '13px', color: '#6b6b6b', margin: '0 0 20px' }
const text = { fontSize: '14px', lineHeight: '22px', margin: '0 0 12px' }
const item = {
  borderLeft: '3px solid #A37670',
  padding: '8px 0 8px 12px',
  margin: '0 0 14px',
}
const itemHead = { fontSize: '14px', fontWeight: 600, margin: '0 0 4px' }
const small = { fontSize: '12px', color: '#6b6b6b', lineHeight: '18px', margin: '0 0 4px' }
const hr = { borderColor: '#e7e5e0', margin: '24px 0' }

function label(i: PipelineAlertItem) {
  if (i.kind === 'stalled') {
    return `Stalled after ${i.minutesRunning ?? '?'} minutes`
  }
  return `Failed (status: ${i.status ?? 'unknown'})`
}

export function PipelineAlertEmail({
  items = [],
  stallMinutes,
  dashboardUrl,
  checkedAt,
}: PipelineAlertProps) {
  const count = items.length
  return (
    <Html>
      <Head />
      <Preview>{`${count} pipeline ${count === 1 ? 'run needs' : 'runs need'} attention`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Pipeline attention needed</Heading>
          <Text style={meta}>
            {count} {count === 1 ? 'run' : 'runs'} flagged
            {checkedAt ? ` at ${checkedAt}` : ''}.
          </Text>

          <Section>
            {items.map((i, idx) => (
              <div key={idx} style={item}>
                <Text style={itemHead}>{i.agentName ?? 'unknown agent'}</Text>
                <Text style={small}>{label(i)}</Text>
                <Text style={small}>
                  Week of {i.weekStart || 'unknown'}. Started {i.startedAt || 'unknown'}.
                </Text>
                {i.detail ? <Text style={small}>{i.detail}</Text> : null}
              </div>
            ))}
          </Section>

          <Hr style={hr} />
          <Text style={small}>
            A run counts as stalled when it is still marked running
            {stallMinutes ? ` more than ${stallMinutes} minutes` : ''} after it started.
          </Text>
          {dashboardUrl ? (
            <Text style={text}>
              Full run log: <a href={dashboardUrl}>{dashboardUrl}</a>
            </Text>
          ) : null}
        </Container>
      </Body>
    </Html>
  )
}

export const template: TemplateEntry = {
  component: PipelineAlertEmail,
  subject: (data) => {
    const n = Array.isArray(data?.items) ? data.items.length : 0
    return `Pipeline alert: ${n} ${n === 1 ? 'run needs' : 'runs need'} attention`
  },
  displayName: 'Pipeline failure or stall alert',
  previewData: {
    items: [
      {
        agentName: 'site-data-agent',
        weekStart: '2026-07-27',
        kind: 'failed',
        status: 'failed',
        startedAt: 'Jul 27, 2026, 12:07 AM',
        detail: 'contract feed returned 0 rows',
      },
      {
        agentName: 'monthly-report-agent',
        weekStart: '2026-06-01',
        kind: 'stalled',
        status: 'running',
        startedAt: 'Aug 01, 2026, 10:54 PM',
        minutesRunning: 214,
        detail: null,
      },
    ],
    stallMinutes: 90,
    dashboardUrl: 'https://domidata.heatherdomi.com/pipeline-runs',
    checkedAt: 'Aug 02, 2026, 11:00 PM',
  },
}
