interface JsonViewerProps {
  data: Record<string, unknown> | null
}

export function JsonViewer({ data }: JsonViewerProps) {
  if (!data) {
    return (
      <div className="flex h-full min-h-[200px] items-center justify-center rounded-lg border border-dashed bg-muted/50 p-4 text-sm text-muted-foreground">
        生成的 JSON 将在此处显示
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-muted/50 overflow-auto">
      <pre className="p-4 text-xs font-mono whitespace-pre text-foreground">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  )
}
