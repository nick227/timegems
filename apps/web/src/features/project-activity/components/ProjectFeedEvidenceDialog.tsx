import { useState } from 'react'
import type { ProjectFeedItem } from '@timegems/sdk'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'

interface ProjectFeedEvidenceDialogProps {
  item: ProjectFeedItem
}

export function ProjectFeedEvidenceDialog({ item }: ProjectFeedEvidenceDialogProps) {
  const [open, setOpen] = useState(false)
  const evidence = item.evidence

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        View changes
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title="Evidence" description="Source material used for this feed item.">
        <div className="space-y-4 text-sm">
          {evidence?.commits?.length ? (
            <section className="space-y-1">
              <p className="font-medium">Commits</p>
              <ul className="space-y-1 text-muted-foreground">
                {evidence.commits.map((commit) => (
                  <li key={commit.sha}>
                    <code>{commit.sha.slice(0, 7)}</code> {commit.message}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {evidence?.filesChanged?.length ? (
            <section className="space-y-1">
              <p className="font-medium">Changed files</p>
              <ul className="list-disc pl-5 text-muted-foreground">
                {evidence.filesChanged.map((file) => (
                  <li key={file}>{file}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {evidence?.pullRequest ? (
            <section className="space-y-1">
              <p className="font-medium">Pull request</p>
              <a className="text-primary underline" href={evidence.pullRequest.url} target="_blank" rel="noreferrer">
                #{evidence.pullRequest.number} {evidence.pullRequest.title}
              </a>
            </section>
          ) : null}

          {evidence?.checkRun ? (
            <section className="space-y-1">
              <p className="font-medium">CI</p>
              <p className="text-muted-foreground">
                {evidence.checkRun.name}: {evidence.checkRun.conclusion ?? 'pending'}
              </p>
            </section>
          ) : null}

          {evidence?.limitations?.length ? (
            <section className="space-y-1">
              <p className="font-medium">Caveats</p>
              <ul className="list-disc pl-5 text-muted-foreground">
                {evidence.limitations.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {(item.links?.length || evidence?.links.length) ? (
            <section className="space-y-1">
              <p className="font-medium">Links</p>
              <ul className="space-y-1">
                {(item.links ?? evidence?.links ?? []).map((link) => (
                  <li key={link.url}>
                    <a className="text-primary underline" href={link.url} target="_blank" rel="noreferrer">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </Dialog>
    </>
  )
}
