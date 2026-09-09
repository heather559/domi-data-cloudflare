import * as React from 'react'
import {
  Body,
  Button,
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

export interface MonthlyExportProps {
  monthLabel?: string
  downloadUrl?: string
  filename?: string
  neighborhoodsWithData?: number
  neighborhoodsTotal?: number
  contradictions?: number
  isProvisional?: boolean
  linkExpiresLabel?: string
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
const button = {
  backgroundColor: '#918C7E',
  color: '#ffffff',
  fontSize: '14px',
  padding: '12px 20px',
  borderRadius: '2px',
  textDecoration: 'none',
  display: 'inline-block',
}
const hr = { borderColor: '#e7e5e0', margin: '24px 0' }
const small = { fontSize: '12px', color: '#6b6b6b', lineHeight: '18px', margin: '0 0 6px' }

export function MonthlyExportEmail({
  monthLabel,
  downloadUrl,
  filename,
  neighborhoodsWithData,
  neighborhoodsTotal,
  contradictions,
  isProvisional,
  linkExpiresLabel,
}: MonthlyExportProps) {
  return (
    <Html>
      <Head />
      <Preview>Domi Data monthly tracker workbook</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Monthly tracker workbook</Heading>
          <Text style={meta}>{monthLabel ?? 'Latest published month'}</Text>

          <Text style={text}>
            The new month has landed. The workbook carries the Manhattan monthly figures with
            month over month, year over year and the gap to the trailing three and twelve month
            averages, the tier detail, the twelve month history, the leaderboard, one row per
            neighborhood, each neighborhood's twelve month history, bedroom mix, the So What audit
            grid and the bedroom label map.
          </Text>

          <Section style={{ margin: '20px 0' }}>
            <Button href={downloadUrl} style={button}>
              Download {filename ?? 'workbook'}
            </Button>
          </Section>

          <Hr style={hr} />

          <Text style={small}>
            Neighborhoods with published data: {neighborhoodsWithData ?? 0} of{' '}
            {neighborhoodsTotal ?? 0}.
          </Text>
          <Text style={small}>Sentences contradicting their inputs: {contradictions ?? 0}.</Text>
          {isProvisional ? (
            <Text style={small}>
              The month is still marked provisional. Numbers can move as filings settle.
            </Text>
          ) : null}
          {linkExpiresLabel ? <Text style={small}>Link valid until {linkExpiresLabel}.</Text> : null}
          <Text style={small}>Data powered by Marketproof.</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template: TemplateEntry = {
  component: MonthlyExportEmail,
  subject: (data) =>
    `Domi Data monthly tracker${data?.monthLabel ? ` · ${data.monthLabel}` : ''}`,
  displayName: 'Monthly tracker export',
  previewData: {
    monthLabel: 'June 2026',
    downloadUrl: 'https://example.com/workbook.xlsx',
    filename: 'domi-data-monthly-tracker-2026-06.xlsx',
    neighborhoodsWithData: 10,
    neighborhoodsTotal: 10,
    contradictions: 0,
    isProvisional: false,
    linkExpiresLabel: '2026-09-01',
  },
}
