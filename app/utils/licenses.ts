// Licences offered on the model card (#111, item 18): a fixed list avoids spellings that
// differ from model to model and makes the Commons licence filter useful. Values are SPDX
// identifiers (https://spdx.org/licenses/); anything else goes in as the provider's own
// licence text.
export const LICENSES = [
  { value: 'MIT', label: 'MIT License' },
  { value: 'Apache-2.0', label: 'Apache License 2.0' },
  { value: 'BSD-3-Clause', label: 'BSD 3-Clause License' },
  { value: 'BSD-2-Clause', label: 'BSD 2-Clause License' },
  { value: 'GPL-3.0-or-later', label: 'GNU GPL v3.0 or later' },
  { value: 'GPL-2.0-or-later', label: 'GNU GPL v2.0 or later' },
  { value: 'AGPL-3.0-or-later', label: 'GNU AGPL v3.0 or later' },
  { value: 'LGPL-3.0-or-later', label: 'GNU LGPL v3.0 or later' },
  { value: 'MPL-2.0', label: 'Mozilla Public License 2.0' },
  { value: 'EUPL-1.2', label: 'European Union Public Licence 1.2' },
  { value: 'CC-BY-4.0', label: 'Creative Commons Attribution 4.0' },
  { value: 'CC-BY-SA-4.0', label: 'Creative Commons Attribution-ShareAlike 4.0' },
  { value: 'CC0-1.0', label: 'Creative Commons Zero 1.0' },
] as const

/** The listed licence for a stored value, ignoring case and surrounding spaces. */
export function knownLicense(value: string) {
  const v = value.trim().toLowerCase()
  return v ? LICENSES.find(l => l.value.toLowerCase() === v) : undefined
}
