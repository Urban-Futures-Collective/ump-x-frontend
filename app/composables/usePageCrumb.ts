// The last breadcrumb entry below a sidebar section, such as the model on a model page
// ("Contribute / Grow a Bike Network"). The page sets it, the layout shows it.
export function usePageCrumbLabel() {
  return useState<string>('page-crumb', () => '')
}

export function usePageCrumb(label: () => string) {
  const crumb = usePageCrumbLabel()
  watchEffect(() => { crumb.value = label() })
  onBeforeUnmount(() => { crumb.value = '' })
}
