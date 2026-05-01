import { driver, localDriver } from '@/api'
import { buildSeedTracks } from './tracks'
import {
  buildSeedAnnotations,
  buildSeedDictionary,
  buildSeedRhymes,
} from './extras'

export async function ensureSeed() {
  if (!localDriver) return
  if (localDriver.isSeeded()) return

  for (const track of buildSeedTracks()) await driver.saveTrack(track)
  for (const a of buildSeedAnnotations()) await driver.saveAnnotation(a)
  for (const d of buildSeedDictionary()) await driver.saveDictionaryEntry(d)
  for (const r of buildSeedRhymes()) await driver.saveRhymeGroup(r)

  localDriver.markSeeded()
}

export async function resetSeed() {
  if (!localDriver) return
  localDriver.reset()
  await ensureSeed()
}
