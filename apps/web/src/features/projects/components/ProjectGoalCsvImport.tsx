import { useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { useImportProjectGoals } from '@timegems/sdk'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Input } from '@/components/ui/Input'

type ImportedGoal = {
  title: string
  description: string
  complexityScore?: number
  estimatedHours?: number | null
}

const MAX_FILE_BYTES = 1_000_000
const MAX_GOALS = 500
const TEMPLATE = `title,description,complexityScore,estimatedHours
"Ship onboarding","Define and deliver the first-run experience",3,12
"Measure activation","Add the core activation event and dashboard",2,6
`

function parseCsvRows(source: string) {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let index = 0; index < source.length; index++) {
    const character = source[index]
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        cell += '"'
        index++
      } else if (character === '"') {
        quoted = false
      } else {
        cell += character
      }
    } else if (character === '"') {
      quoted = true
    } else if (character === ',') {
      row.push(cell)
      cell = ''
    } else if (character === '\n') {
      row.push(cell)
      if (row.some((value) => value.trim())) rows.push(row)
      row = []
      cell = ''
    } else if (character !== '\r') {
      cell += character
    }
  }

  if (quoted) throw new Error('The CSV contains an unclosed quoted value.')
  row.push(cell)
  if (row.some((value) => value.trim())) rows.push(row)
  return rows
}

function normalizedHeader(value: string) {
  return value.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/[\s_-]+/g, '')
}

function parseProjectGoalsCsv(source: string): { goals: ImportedGoal[]; errors: string[] } {
  const rows = parseCsvRows(source)
  if (rows.length === 0) return { goals: [], errors: ['The CSV file is empty.'] }

  const headers = rows[0]!.map(normalizedHeader)
  const column = (name: string) => headers.indexOf(name)
  const titleColumn = column('title')
  const descriptionColumn = column('description')
  const complexityColumn = column('complexityscore') >= 0 ? column('complexityscore') : column('complexity')
  const hoursColumn = column('estimatedhours')
  if (titleColumn < 0) return { goals: [], errors: ['The CSV must include a title column.'] }

  const goals: ImportedGoal[] = []
  const errors: string[] = []
  for (const [index, row] of rows.slice(1).entries()) {
    const line = index + 2
    const title = (row[titleColumn] ?? '').trim()
    const description = descriptionColumn >= 0 ? (row[descriptionColumn] ?? '').trim() : ''
    const rawComplexity = complexityColumn >= 0 ? (row[complexityColumn] ?? '').trim() : ''
    const rawHours = hoursColumn >= 0 ? (row[hoursColumn] ?? '').trim() : ''
    const complexityScore = rawComplexity ? Number(rawComplexity) : 3
    const estimatedHours = rawHours ? Number(rawHours) : null

    if (!title) errors.push(`Line ${line}: title is required.`)
    else if (title.length > 200) errors.push(`Line ${line}: title must be 200 characters or fewer.`)
    if (description.length > 5000) errors.push(`Line ${line}: description must be 5,000 characters or fewer.`)
    if (!Number.isInteger(complexityScore) || complexityScore < 1 || complexityScore > 5) {
      errors.push(`Line ${line}: complexityScore must be a whole number from 1 to 5.`)
    }
    if (estimatedHours !== null && (!Number.isFinite(estimatedHours) || estimatedHours < 0)) {
      errors.push(`Line ${line}: estimatedHours must be zero or greater.`)
    }

    if (errors.length === 0 || !errors.some((error) => error.startsWith(`Line ${line}:`))) {
      goals.push({ title, description, complexityScore, estimatedHours })
    }
  }

  if (goals.length > MAX_GOALS) errors.push(`A single import can contain at most ${MAX_GOALS} goals.`)
  if (goals.length === 0 && errors.length === 0) errors.push('The CSV does not contain any goal rows.')
  return { goals, errors }
}

function downloadTemplate() {
  const url = URL.createObjectURL(new Blob([TEMPLATE], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'project-goals-template.csv'
  link.click()
  URL.revokeObjectURL(url)
}

export function ProjectGoalCsvImport({ projectId }: { projectId: string }) {
  const importGoals = useImportProjectGoals(projectId)
  const [goals, setGoals] = useState<ImportedGoal[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [fileName, setFileName] = useState('')
  const [inputKey, setInputKey] = useState(0)

  async function selectFile(file?: File) {
    setGoals([])
    setErrors([])
    setFileName(file?.name ?? '')
    if (!file) return
    if (file.size > MAX_FILE_BYTES) {
      setErrors(['The CSV file must be smaller than 1 MB.'])
      return
    }
    try {
      const parsed = parseProjectGoalsCsv(await file.text())
      setGoals(parsed.goals)
      setErrors(parsed.errors)
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'The CSV could not be read.'])
    }
  }

  async function handleImport() {
    if (goals.length === 0 || errors.length > 0) return
    try {
      const result = await importGoals.mutateAsync(goals)
      toast.success(`${result.data.imported} ${result.data.imported === 1 ? 'goal' : 'goals'} imported`)
      setGoals([])
      setFileName('')
      setInputKey((current) => current + 1)
    } catch {
      // handled by the global mutation error toast
    }
  }

  return (
    <div className="space-y-3 rounded-lg bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Import goals from CSV</p>
          <p className="text-xs text-muted-foreground">
            Columns: title, description, complexityScore (1–5), estimatedHours.
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={downloadTemplate}>
          <Download size={14} />
          Template
        </Button>
      </div>

      <Field label="Goal CSV file">
        <Input
          key={inputKey}
          type="file"
          accept=".csv,text/csv"
          voice={false}
          onChange={(event) => void selectFile(event.target.files?.[0])}
        />
      </Field>

      {errors.length > 0 && (
        <div role="alert" className="space-y-1 text-sm text-destructive">
          {errors.slice(0, 5).map((error) => (
            <p key={error}>{error}</p>
          ))}
          {errors.length > 5 && <p>And {errors.length - 5} more errors.</p>}
        </div>
      )}
      {goals.length > 0 && errors.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {fileName}: {goals.length} {goals.length === 1 ? 'goal' : 'goals'} ready.
        </p>
      )}

      <Button
        size="sm"
        loading={importGoals.isPending}
        disabled={goals.length === 0 || errors.length > 0}
        onClick={() => void handleImport()}
      >
        <Upload size={14} />
        Import {goals.length || ''} {goals.length === 1 ? 'goal' : 'goals'}
      </Button>
    </div>
  )
}
