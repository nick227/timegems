import { useMutation } from '@tanstack/react-query'
import { getApiClient, ApiError } from '../client'
import type { components } from '../generated/types'

type TextAssistMode = components['schemas']['TextAssistMode']

export function useTextAssist() {
  return useMutation({
    mutationFn: async ({ text, mode }: { text: string; mode: TextAssistMode }) => {
      const { data, error, response } = await getApiClient().POST('/text-assist', { body: { text, mode } })
      if (error) throw new ApiError(response.status, (error as any).error)
      return data!
    },
  })
}
