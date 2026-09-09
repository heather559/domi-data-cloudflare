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

export interface TranscriptTurn {
  role: 'user' | 'assistant'
  text: string
}

export interface HandoffTranscriptProps {
  leadName?: string
  leadEmail?: string
  leadPhone?: string
  intent?: string
  neighborhoods?: string[]
  priceRange?: string
  timeline?: string
  message?: string
  sourcePath?: string
  sessionId?: string
  tier?: string
  leadSource?: 'ask-heather' | 'buy-sell' | 'contact'
  reason?: string
  transcript?: TranscriptTurn[]
}

const main = {
  backgroundColor: '#ffffff',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  color: '#0a0a0a',
}
const container = { padding: '32px 28px', maxWidth: '640px' }
const h1 = { fontSize: '20px', fontWeight: 600, margin: '0 0 4px', letterSpacing: '0.01em' }
const eyebrow = {
  fontSize: '11px',
  letterSpacing: '0.24em',
  textTransform: 'uppercase' as const,
  color: '#918C7E',
  margin: '0 0 16px',
}
const label = { fontSize: '11px', color: '#6b6b6b', margin: '0 0 2px', letterSpacing: '0.08em', textTransform: 'uppercase' as const }
const value = { fontSize: '14px', margin: '0 0 12px', color: '#0a0a0a' }
const turnUser = { fontSize: '14px', margin: '0 0 10px', color: '#0a0a0a' }
const turnAgent = { fontSize: '14px', margin: '0 0 14px', color: '#333' }
const sectionHead = { fontSize: '12px', letterSpacing: '0.2em', textTransform: 'uppercase' as const, margin: '24px 0 12px', color: '#918C7E' }

function titleCase(s: string): string {
  return s.replace(/(^|[\s-])(\w)/g, (_, sep, ch) => `${sep}${ch.toUpperCase()}`)
}

function sourceLabel(src: HandoffTranscriptProps['leadSource'], reason?: string): string {
  if (src === 'ask-heather') return 'Ask Heather Handoff'
  if (src === 'contact') {
    const r = reason ? titleCase(reason) : ''
    return r ? `Contact Inquiry, ${r}` : 'Contact Inquiry'
  }
  return 'Buy / Sell Inquiry'
}

function subjectLabel(src: HandoffTranscriptProps['leadSource'], reason?: string): string {
  if (src === 'ask-heather') return 'Ask Heather handoff'
  if (src === 'contact') {
    const r = reason ? titleCase(reason) : ''
    return r ? `Contact inquiry, ${r}` : 'Contact inquiry'
  }
  return 'Buy / Sell inquiry'
}

const HandoffTranscript = ({
  leadName,
  leadEmail,
  leadPhone,
  intent,
  neighborhoods,
  priceRange,
  timeline,
  message,
  sourcePath,
  sessionId,
  tier,
  leadSource,
  reason,
  transcript,
}: HandoffTranscriptProps) => {
  const turns = transcript ?? []
  const nb = neighborhoods?.length ? neighborhoods.join(', ') : ''
  const eyebrowLabel = sourceLabel(leadSource, reason)
  return (
    <Html lang="en">
      <Head />
      <Preview>{`${eyebrowLabel}${leadName ? `: ${leadName}` : ''}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={eyebrow}>{eyebrowLabel}</Text>
          <Heading style={h1}>{leadName || 'New lead'}</Heading>
          {leadEmail ? <Text style={{ ...value, margin: '0 0 4px', color: '#555' }}>{leadEmail}</Text> : null}
          {leadPhone ? <Text style={{ ...value, margin: '0 0 4px', color: '#555' }}>{leadPhone}</Text> : null}

          <Section style={{ marginTop: '20px' }}>
            {intent ? (<><Text style={label}>Intent</Text><Text style={value}>{intent}</Text></>) : null}
            {nb ? (<><Text style={label}>Neighborhoods</Text><Text style={value}>{nb}</Text></>) : null}
            {priceRange ? (<><Text style={label}>Price range</Text><Text style={value}>{priceRange}</Text></>) : null}
            {timeline ? (<><Text style={label}>Timeline</Text><Text style={value}>{timeline}</Text></>) : null}
            {message ? (<><Text style={label}>Note from lead</Text><Text style={value}>{message}</Text></>) : null}
            {sourcePath ? (<><Text style={label}>Page</Text><Text style={value}>{sourcePath}</Text></>) : null}
            {tier ? (<><Text style={label}>Gate</Text><Text style={value}>{tier}</Text></>) : null}
            {sessionId ? (<><Text style={label}>Session</Text><Text style={value}>{sessionId}</Text></>) : null}
          </Section>

          {turns.length > 0 ? (
            <>
              <Hr style={{ borderColor: '#e5e2dc', margin: '24px 0 0' }} />
              <Text style={sectionHead}>Transcript</Text>
              {turns.map((t, i) => (
                <Text key={i} style={t.role === 'user' ? turnUser : turnAgent}>
                  <strong>{t.role === 'user' ? 'Visitor: ' : 'Heather (AI): '}</strong>
                  {t.text}
                </Text>
              ))}
            </>
          ) : null}
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: HandoffTranscript,
  subject: (data: Record<string, any>) => {
    const name = (data.leadName as string) || 'New lead'
    const label = subjectLabel(data.leadSource, data.reason)
    return `${label}: ${name}`
  },
  displayName: 'Lead Notification',
  previewData: {
    leadName: 'Jane Doe',
    leadEmail: 'jane@example.com',
    leadPhone: '(555) 555-1212',
    intent: 'buying',
    neighborhoods: ['tribeca', 'west-village'],
    priceRange: '5-10m',
    timeline: '3-months',
    sourcePath: '/buy-sell',
    leadSource: 'buy-sell',
    transcript: [],
  },
} satisfies TemplateEntry
