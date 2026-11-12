// Model servers and their models with access roles, and how many people have access
// (design A4, left column). A person counts once per server, whether through the server
// role or one or more model roles.
export default defineEventHandler(async (event) => {
  await requireRole(event, ROLE_ACCESS_ADMIN)
  const catalog = await loadAccessCatalog()

  return Promise.all(catalog.map(async (s) => {
    const [serverIds, ...modelIds] = await Promise.all([
      s.hasRole ? membersOf(s.name) : Promise.resolve(new Set<string>()),
      ...s.processes.map(p => membersOf(`${s.name}:${p}`)),
    ])
    const all = new Set([...serverIds!, ...modelIds.flatMap(ids => [...ids])])
    return {
      name: s.name,
      hasRole: s.hasRole,
      users: all.size,
      models: s.processes.map((process, i) => ({ process, users: new Set([...serverIds!, ...modelIds[i]!]).size })),
    }
  }))
})
