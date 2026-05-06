// Minimal in-memory stand-in for the supabase-js query builder. Covers only the
// methods SupabaseDriver actually calls. If the driver grows new query shapes,
// this stub must grow with it (and the driver contract will catch that).

type Row = Record<string, unknown>

type Filter = { col: string; val: unknown }
type Order = { col: string; ascending: boolean }

export class FakeSupabase {
  tables: Record<string, Row[]> = {
    tracks: [],
    annotations: [],
    rhyme_groups: [],
    dictionary_entries: [],
  }

  from(table: string) {
    if (!this.tables[table]) this.tables[table] = []
    return new Builder(this.tables[table])
  }
}

class Builder {
  private filters: Filter[] = []
  // Use distinct names so the prototype methods (`order`, `select`) aren't
  // shadowed by instance fields.
  private _order: Order | null = null
  private mode: 'select' | 'insert' | 'upsert' | 'delete' = 'select'
  private payload: Row | null = null

  constructor(private rows: Row[]) {}

  select(_cols = '*') {
    if (this.mode === 'select') {
      // already in select mode; chained after upsert/insert is also valid
    }
    return this
  }

  eq(col: string, val: unknown) {
    this.filters.push({ col, val })
    return this
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this._order = { col, ascending: opts?.ascending ?? true }
    return this
  }

  upsert(row: Row, _opts?: { onConflict?: string }) {
    this.mode = 'upsert'
    this.payload = row
    return this
  }

  insert(row: Row) {
    this.mode = 'insert'
    this.payload = row
    return this
  }

  delete() {
    this.mode = 'delete'
    return this
  }

  private apply(): Row[] {
    return this.rows.filter((r) => this.filters.every((f) => r[f.col] === f.val))
  }

  private execute(): Row[] {
    if (this.mode === 'upsert') {
      const id = (this.payload as Row).id
      const idx = this.rows.findIndex((r) => r.id === id)
      const next: Row = {
        ...((this.payload ?? {}) as Row),
        // server defaults that real Postgres would set
        created_at: (this.rows[idx]?.created_at as string) ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      if (idx === -1) this.rows.push(next)
      else this.rows[idx] = next
      return [next]
    }
    if (this.mode === 'insert') {
      const row = { ...(this.payload as Row) }
      this.rows.push(row)
      return [row]
    }
    if (this.mode === 'delete') {
      const matched = this.apply()
      for (const r of matched) {
        const idx = this.rows.indexOf(r)
        if (idx !== -1) this.rows.splice(idx, 1)
      }
      return matched
    }
    let res = this.apply()
    if (this._order) {
      const { col, ascending } = this._order
      res = [...res].sort((a, b) => {
        const av = String(a[col] ?? '')
        const bv = String(b[col] ?? '')
        return ascending ? av.localeCompare(bv) : bv.localeCompare(av)
      })
    }
    return res
  }

  // The supabase-js builder is a thenable; awaiting it runs the query.
  then<T1, T2>(
    onFulfilled?: (v: { data: Row[] | null; error: null }) => T1 | PromiseLike<T1>,
    onRejected?: (e: unknown) => T2 | PromiseLike<T2>,
  ) {
    return Promise.resolve({ data: this.execute(), error: null }).then(onFulfilled, onRejected)
  }

  async maybeSingle() {
    const rows = this.execute()
    return { data: rows[0] ?? null, error: null }
  }

  async single() {
    const rows = this.execute()
    if (rows.length === 0) return { data: null, error: { message: 'no rows' } }
    return { data: rows[0], error: null }
  }
}
