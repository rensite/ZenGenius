import { beforeEach } from 'vitest'
import { LocalDriver } from '@/api/drivers/local.driver'
import { runDriverContract } from './contracts/driver.contract'

beforeEach(() => {
  localStorage.clear()
})

runDriverContract('LocalDriver', () => new LocalDriver())
