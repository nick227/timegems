import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { useImportProjectGoals } from '@timegems/sdk'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'

type ImportedGoal = {
  title: string
  description: string
  complexityScore?: number
  estimatedHours?: number | null
}

const MAX_FILE_BYTES = 1_000_000
const MAX_GOALS = 500

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

// One button: pick a CSV → parse → import immediately. Status text covers
// "importing…" feedback; toast confirms the result.
export function ProjectGoalCsvImport({ projectId }: { projectId: string }) {
  const importGoals = useImportProjectGoals(projectId)
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [errors, setErrors] = useState<string[]>([])

  async function handleFile(file?: File) {
    setErrors([])
    setStatus(null)
    if (!file) return
    if (file.size > MAX_FILE_BYTES) {
      setErrors(['The CSV file must be smaller than 1 MB.'])
      return
    }

    try {
      const parsed = parseProjectGoalsCsv(await file.text())
      if (parsed.errors.length > 0) {
        setErrors(parsed.errors)
        return
      }
      setStatus(`Importing ${parsed.goals.length} ${parsed.goals.length === 1 ? 'goal' : 'goals'}…`)
      const result = await importGoals.mutateAsync(parsed.goals)
      setStatus(null)
      toast.success(`${result.data.imported} ${result.data.imported === 1 ? 'goal' : 'goals'} imported`)
    } catch (error) {
      setStatus(null)
      if (error instanceof Error && !(error as { status?: number }).status) {
        setErrors([error.message])
      }
      // API failures are handled by the global mutation error toast
    } finally {
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        aria-label="Import goals CSV"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
      <Button
        size="sm"
        variant="outline"
        loading={importGoals.isPending}
        onClick={() => inputRef.current?.click()}
      >
        <Upload size={14} />
        Import goals
      </Button>
      {status && <p className="text-sm text-muted-foreground">{status}</p>}
      {errors.length > 0 && (
        <div role="alert" className="space-y-1 text-sm text-destructive">
          {errors.slice(0, 5).map((error) => (
            <p key={error}>{error}</p>
          ))}
          {errors.length > 5 && <p>And {errors.length - 5} more errors.</p>}
        </div>
      )}
    </div>
  )
}
