import { LocalDriver, type DataDriver } from './drivers/local.driver'
import { HttpDriver } from './drivers/http.driver'

const apiUrl = import.meta.env.VITE_API_URL as string | undefined

export const driver: DataDriver = apiUrl
  ? new HttpDriver(apiUrl)
  : new LocalDriver()

export const localDriver = driver instanceof LocalDriver ? (driver as LocalDriver) : null
