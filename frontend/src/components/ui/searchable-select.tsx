import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckIcon, ChevronDownIcon, SearchIcon } from 'lucide-react'
import { cn } from 'cn'

export interface SearchableSelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface SearchableSelectProps {
  value: string | null | undefined
  onValueChange: (value: string | null) => void
  options: SearchableSelectOption[]
  placeholder?: string
  disabled?: boolean
  className?: string
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

export function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder = '请选择',
  disabled = false,
  className,
  defaultOpen = false,
  onOpenChange,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(defaultOpen)
  const [search, setSearch] = useState('')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number; width: number }>({ left: 0, width: 0 })

  const filtered = useMemo(() => {
    if (!search) return options
    const lower = search.toLowerCase()
    return options.filter((o) => o.label.toLowerCase().includes(lower) || o.value.toLowerCase().includes(lower))
  }, [options, search])

  const selectedLabel = useMemo(() => {
    const found = options.find((o) => o.value === value)
    return found?.label ?? null
  }, [options, value])

  const handleSelect = useCallback(
    (val: string) => {
      onValueChange(val)
      setOpen(false)
      setSearch('')
      onOpenChange?.(false)
    },
    [onValueChange, onOpenChange],
  )

  const closeDropdown = useCallback(() => {
    setOpen(false)
    setSearch('')
    onOpenChange?.(false)
  }, [onOpenChange])

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    if (spaceBelow < 260) {
      setPos({
        bottom: window.innerHeight - rect.top + 4,
        left: rect.left,
        width: rect.width,
      })
    } else {
      setPos({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      })
    }
  }, [])

  useLayoutEffect(() => {
    if (open) {
      updatePosition()
      setSearch('')
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        triggerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) return
      closeDropdown()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, closeDropdown])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDropdown()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, closeDropdown])

  useEffect(() => {
    if (!open) return
    const onScroll = () => updatePosition()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open, updatePosition])

  const dropdownStyle: React.CSSProperties = {
    left: pos.left,
    width: Math.max(pos.width, 144),
    ...(pos.bottom !== undefined ? { bottom: pos.bottom } : { top: pos.top }),
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) { if (open) closeDropdown(); else setOpen(true) } }}
        className={cn(
          'flex w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none h-8',
          'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'dark:bg-input/30 dark:hover:bg-input/50',
          !value && 'text-muted-foreground',
          className,
        )}
      >
        <span className="flex-1 text-left truncate">
          {selectedLabel ?? placeholder}
        </span>
        <ChevronDownIcon className="pointer-events-none size-4 shrink-0 text-muted-foreground" />
      </button>

      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            className={cn(
              'fixed z-[9999] rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10',
              pos.bottom !== undefined
                ? 'origin-bottom animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2'
                : 'origin-top animate-in fade-in-0 zoom-in-95 slide-in-from-top-2',
            )}
            style={dropdownStyle}
          >
            <div className="flex items-center gap-2 border-b px-2 py-1.5">
              <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索…"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <div className="max-h-52 overflow-y-auto p-1 scroll-my-1">
              {filtered.length === 0 ? (
                <div className="py-3 text-center text-xs text-muted-foreground">无匹配项</div>
              ) : (
                filtered.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={opt.disabled}
                    onClick={() => handleSelect(opt.value)}
                    className={cn(
                      'relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none',
                      'focus:bg-accent focus:text-accent-foreground',
                      'hover:bg-accent hover:text-accent-foreground',
                      opt.disabled && 'pointer-events-none opacity-50',
                    )}
                  >
                    <span className="flex-1 text-left truncate">{opt.label}</span>
                    {opt.value === value && (
                      <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
                        <CheckIcon className="size-4" />
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
