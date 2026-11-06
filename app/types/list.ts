/** One choice in a list's sort or filter menu. */
export interface ListOption {
  value: string
  label: string
}

/**
 * A filter of a list (status, server, topic …). Its value in the ListBar model is the
 * list of chosen values; empty means "all". Single filters hold at most one value.
 */
export interface ListFilter {
  key: string
  label: string
  items: ListOption[]
  multiple?: boolean
  /** Label of the "no filter" entry of a single filter, e.g. "All statuses". */
  allLabel?: string
}
