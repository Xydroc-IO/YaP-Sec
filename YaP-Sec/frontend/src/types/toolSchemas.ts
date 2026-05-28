export type AdvancedFieldType = 'boolean' | 'string' | 'number' | 'select'

export interface AdvancedField {
  key: string
  label: string
  type: AdvancedFieldType
  flag: string
  placeholder?: string
  defaultValue?: string | number | boolean
  options?: Array<{ label: string; value: string }>
  joinWithEquals?: boolean
}

export const NMAP_FIELDS: AdvancedField[] = [
  { key: 'pn', label: 'No ping', type: 'boolean', flag: '-Pn' },
  { key: 'open', label: 'Open only', type: 'boolean', flag: '--open' },
  { key: 'timing', label: 'Timing', type: 'select', flag: '-T', options: [{ label: 'T2', value: '2' }, { label: 'T3', value: '3' }, { label: 'T4', value: '4' }], defaultValue: '4' },
  { key: 'ports', label: 'Ports', type: 'string', flag: '-p', placeholder: '80,443,8080' },
]

export const SQLMAP_FIELDS: AdvancedField[] = [
  { key: 'dbs', label: 'Enumerate DBs', type: 'boolean', flag: '--dbs' },
  { key: 'batch', label: 'Batch mode', type: 'boolean', flag: '--batch', defaultValue: true },
  { key: 'threads', label: 'Threads', type: 'number', flag: '--threads', defaultValue: 3 },
  { key: 'tamper', label: 'Tamper', type: 'string', flag: '--tamper', placeholder: 'space2comment' },
]

export const NUCLEI_FIELDS: AdvancedField[] = [
  { key: 'rate', label: 'Rate limit', type: 'number', flag: '-rate-limit', defaultValue: 100 },
  { key: 'conc', label: 'Concurrency', type: 'number', flag: '-c', defaultValue: 20 },
  { key: 'timeout', label: 'Timeout', type: 'number', flag: '-timeout', defaultValue: 5 },
  { key: 'templates', label: 'Templates dir', type: 'string', flag: '-t', placeholder: '/path/to/templates' },
]

export const AIRCRACK_FIELDS: AdvancedField[] = [
  { key: 'band', label: 'Band', type: 'select', flag: '--band', options: [{ label: '2.4GHz', value: 'bg' }, { label: '5GHz', value: 'a' }], defaultValue: 'bg' },
  { key: 'write', label: 'Write prefix', type: 'string', flag: '--write', placeholder: '/tmp/capture' },
  { key: 'ivs', label: 'IVS only', type: 'boolean', flag: '--ivs' },
]
